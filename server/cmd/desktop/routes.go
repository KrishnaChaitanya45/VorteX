package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *App) Router() http.Handler {
	mux := httprouter.New()

	//TODO
	//! Its just used to server the html page to click on login, replace this afterwards

	mux.HandlerFunc(http.MethodGet, "/auth/login", app.Login)
	mux.HandlerFunc(http.MethodGet, "/auth/oauth", app.OAuthHandler)
	mux.HandlerFunc(http.MethodGet, "/oauth/google/callback", app.OAuthCallback)
	mux.HandlerFunc(http.MethodGet, "/set-cookies", app.SetCookies)
	mux.HandlerFunc(http.MethodPost, "/todo/add", app.AddTodo)
	mux.HandlerFunc(http.MethodPost, "/reminders/add", app.AddReminder)
	mux.HandlerFunc(http.MethodGet, "/reminders/get", app.GetReminders)

	return mux
}
