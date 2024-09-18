package main

import (
	"context"
	"encoding/json"
	"html/template"
	"log"
	"net/http"

	"github.com/lib/pq"
	"golang.org/x/oauth2"
)

const (
	UniqueViolationErr = pq.ErrorCode("23505")
)

type UserDetails struct {
	Id      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type Response struct {
	Success bool
	Message string
	UserId  string
}

// ?  !!Authentication Handlers !!
func (app *App) Login(res http.ResponseWriter, req *http.Request) {
	temp, err := template.ParseFiles("cmd/desktop/index.html")

	if err != nil {
		log.Println("ERROR", err)
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	temp.Execute(res, nil)
}

func (app *App) OAuthHandler(res http.ResponseWriter, req *http.Request) {
	url := app.conf.AuthCodeURL("state", oauth2.AccessTypeOffline)
	http.Redirect(res, req, url, http.StatusTemporaryRedirect)
}

func (app *App) OAuthCallback(res http.ResponseWriter, req *http.Request) {
	code := req.URL.Query().Get("code")
	t, err := app.conf.Exchange(req.Context(), code)
	if err != nil {
		ErrorLog.Print("OAuthCallback: ", err)
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	//TODO Store the token "t"
	InfoLog.Print("Token Acquired, Storing the token")
	client := app.conf.Client(context.Background(), t)

	response, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if response.StatusCode != http.StatusOK {
		http.Error(res, "Unexpected response from the server", http.StatusInternalServerError)
		return
	}
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	var jsonResponse UserDetails
	err = json.NewDecoder(response.Body).Decode(&jsonResponse)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	id, err := app.userModel.Insert(jsonResponse.Name, jsonResponse.Picture, jsonResponse.Email)
	if err != nil {
		log.Printf("INSERT FAILED: %s", err.Error())
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	err = app.SessionManager.Set(req.Context(), t.Expiry, t.RefreshToken, t.AccessToken, id, res)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonDetails, err := json.Marshal(Response{
		Success: true,
		Message: "User Authenticated Successfully",
		UserId:  id,
	})
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	res.WriteHeader(http.StatusCreated)
	res.Write(jsonDetails)
}

func (app *App) SetCookies(res http.ResponseWriter, req *http.Request) {
	userId := req.URL.Query().Get("userId")
	if userId == "" {
		ErrorLog.Print("no user id provided")
		http.Error(res, "no user id provided", http.StatusInternalServerError)
		return
	}
	err := app.SessionManager.SetCookies(userId, res)
	if err != nil {
		ErrorLog.Print(err)
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
	type Response struct {
		Success bool
		Message string
	}
	response := Response{
		Success: true,
		Message: "Cookies Have Been Set!",
	}
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		ErrorLog.Printf("Cannot parse the response %v", err)
		http.Error(res, "cannot parse response", http.StatusInternalServerError)
		return
	}
	res.Write(jsonResponse)

}
