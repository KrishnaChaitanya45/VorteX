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
	return mux
}
