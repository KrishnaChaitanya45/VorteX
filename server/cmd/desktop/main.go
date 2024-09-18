package main

import (
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	session_manager "krishna.assistiveball.io/internals/auth"
	"krishna.assistiveball.io/internals/models"
)

type App struct {
	conf           *oauth2.Config
	SessionManager *session_manager.SessionManager
	userModel      *models.UserModel
}

func main() {
	err := godotenv.Load()
	if err != nil {
		ErrorLog.Fatal("FAILED TO LOAD ENVS")
	}
	clientId := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	conf := &oauth2.Config{
		ClientID:     clientId,
		ClientSecret: clientSecret,
		RedirectURL:  "http://localhost:8000/oauth/google/callback",
		Scopes:       []string{"email", "profile"},
		Endpoint:     google.Endpoint,
	}
	db, err := OpenDB(Config["DEFAULT_DATABASE_URI"])
	if err != nil {
		ErrorLog.Fatal(err)
	}
	userModel := &models.UserModel{
		DB: db,
	}
	userModel.Init()
	sessionManager, err := session_manager.Setup(db)
	if err != nil {
		ErrorLog.Fatal(err)
	}
	app := App{conf: conf, SessionManager: sessionManager, userModel: userModel}
	//? Remember to close the database
	defer db.Close()

	server := &http.Server{
		Addr:    ":8000",
		Handler: app.Router(),
	}

	// Log server start before blocking call
	InfoLog.Print("SERVER STARTED LISTENING")

	err = server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		ErrorLog.Fatal(err)
	}
}
