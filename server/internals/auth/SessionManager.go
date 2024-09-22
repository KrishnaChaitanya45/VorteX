package session_manager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

type SessionData struct {
	RefreshToken string
	AccessToken  string
	Expiry       time.Time
	LastActive   time.Time
}

type SessionManager struct {
	mutex    sync.Mutex
	database *sql.DB
}
type SessionError struct {
	Op  string // Operation that caused the error (e.g., "Set", "Get")
	Err error  // The underlying error
}

func (e *SessionError) Error() string {
	return fmt.Sprintf("%s: %v", e.Op, e.Err)
}

func (e *SessionError) Unwrap() error {
	return e.Err
}

func newSessionError(op string, err error) error {
	return &SessionError{
		Op:  op,
		Err: err,
	}
}

// Custom error types
var (
	ErrSessionNotFound   = errors.New("session not found")
	ErrTokenExpired      = errors.New("token expired")
	ErrDatabaseOperation = errors.New("database operation failed")
)

// ? Create the table if not exists
func CreateTokensTable(db *sql.DB) error {
	statement := `
		CREATE TABLE IF NOT EXISTS tokens (
			RefreshToken TEXT NOT NULL,
			AccessToken TEXT NOT NULL,
			Expiry TIMESTAMP NOT NULL,
			LastActive TIMESTAMP NOT NULL,
			UserID TEXT PRIMARY KEY NOT NULL,
			FOREIGN KEY (UserID) REFERENCES users(ID) ON DELETE CASCADE
		)
	`
	_, err := db.Exec(statement)
	if err != nil {
		return err
	}
	return nil
}

func Setup(db *sql.DB) (*SessionManager, error) {
	err := CreateTokensTable(db)
	if err != nil {
		return nil, err
	}
	return &SessionManager{
		database: db,
	}, nil
}

// Set the session data and cookie
func (sm *SessionManager) Set(ctx context.Context, expiry time.Time, refreshToken, accessToken, userID string, w http.ResponseWriter) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	session := &SessionData{
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
		Expiry:       expiry,
		LastActive:   time.Now(),
	}

	_, err := sm.database.Exec(`
		INSERT INTO tokens (RefreshToken, AccessToken, Expiry, LastActive, UserID)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (UserID) DO UPDATE 
		SET AccessToken = EXCLUDED.AccessToken, 
			RefreshToken = EXCLUDED.RefreshToken, 
			Expiry = EXCLUDED.Expiry, 
			LastActive = EXCLUDED.LastActive`,
		session.RefreshToken, session.AccessToken, session.Expiry, session.LastActive, userID)

	if err != nil {
		return newSessionError("Set", fmt.Errorf("%w: failed to set session for user %s", ErrDatabaseOperation, userID))
	}

	return nil
}

func (sm *SessionManager) SetCookies(userId string, res http.ResponseWriter) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	session := &SessionData{}

	statement := "SELECT RefreshToken, AccessToken, Expiry FROM tokens WHERE UserId = $1"

	err := sm.database.QueryRow(statement, userId).Scan(&session.RefreshToken, &session.AccessToken, &session.Expiry)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("user not found")
		}
		return err
	}
	cookie := http.Cookie{
		Name:    "VorteX-Access-Token",
		Value:   session.AccessToken,
		Path:    "/",
		Expires: session.Expiry,
	}
	http.SetCookie(res, &cookie)

	cookie = http.Cookie{
		Name:     "VorteX-Refresh-Token",
		Value:    session.RefreshToken,
		Expires:  session.Expiry,
		Path:     "/",
		Secure:   true,
		HttpOnly: true,
	}
	http.SetCookie(res, &cookie)
	return nil
}

// Get the session data from the request context
func (sm *SessionManager) Get(ctx context.Context, r *http.Request) (*SessionData, error) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	cookie, err := r.Cookie("Vortex-Access-Token")
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return nil, newSessionError("Get", fmt.Errorf("%w: no access token found in cookies", ErrSessionNotFound))
		}
		return nil, newSessionError("Get", fmt.Errorf("%w: failed to retrieve cookie", ErrDatabaseOperation))
	}

	data := SessionData{}
	statement := "SELECT RefreshToken, AccessToken, Expiry, LastActive FROM tokens WHERE AccessToken = $1"
	err = sm.database.QueryRow(statement, cookie.Value).Scan(&data.RefreshToken, &data.AccessToken, &data.Expiry, &data.LastActive)

	if err == sql.ErrNoRows {
		return nil, newSessionError("Get", fmt.Errorf("%w: no session found for the provided token", ErrSessionNotFound))
	} else if err != nil {
		return nil, newSessionError("Get", fmt.Errorf("%w: failed to retrieve session data", ErrDatabaseOperation))
	}

	// Check if the token has expired
	if time.Now().After(data.Expiry) {
		return nil, newSessionError("Get", ErrTokenExpired)
	}

	return &data, nil
}

// Refresh the token if expired and update the session
func (sm *SessionManager) Refresh(ctx context.Context, userID string, conf *oauth2.Config, w http.ResponseWriter, r *http.Request) (*SessionData, error) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	data, err := sm.Get(ctx, r)
	if err != nil {
		return nil, err
	}

	if time.Now().After(data.Expiry) {
		token, err := conf.TokenSource(context.Background(), &oauth2.Token{
			RefreshToken: data.RefreshToken,
		}).Token()
		if err != nil {
			return nil, newSessionError("Refresh", fmt.Errorf("%w: failed to refresh token for user %s", ErrTokenExpired, userID))
		}
		data.AccessToken = token.AccessToken
		data.RefreshToken = token.RefreshToken
		data.Expiry = token.Expiry
		data.LastActive = time.Now()

		err = sm.Set(ctx, data.Expiry, data.RefreshToken, data.AccessToken, userID, w)
		if err != nil {
			return nil, err
		}
	}

	data.LastActive = time.Now()
	return data, nil
}

// Auto-logout user if inactive for more than a month
func (sm *SessionManager) AutoLogout(ctx context.Context, userID string, r *http.Request) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	data, err := sm.Get(ctx, r)
	if err != nil {
		return err
	}

	if time.Since(data.LastActive) > 30*24*time.Hour { // 1 month
		_, err := sm.database.Exec("DELETE FROM tokens WHERE UserID = $1", userID)
		if err != nil {
			return newSessionError("AutoLogout", fmt.Errorf("%w: failed to auto-logout user %s", ErrDatabaseOperation, userID))
		}
	}

	return nil
}

func (sm *SessionManager) ValidateUser(ctx context.Context, req *http.Request) (string, error) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	cookie, err := req.Cookie("Vortex-Access-Token")
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return "", newSessionError("Get", fmt.Errorf("%w: no access token found in cookies", ErrSessionNotFound))
		}
		return "", newSessionError("Get", fmt.Errorf("%w: failed to retrieve cookie", ErrDatabaseOperation))
	}

	statement := "SELECT UserId FROM tokens WHERE AccessToken = $1"

	var id string
	err = sm.database.QueryRow(statement, cookie.Value).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errors.New("no user found with the token")
		}
	}
	return id, err
}
