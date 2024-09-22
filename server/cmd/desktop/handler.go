package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"time"

	"github.com/lib/pq"
	"golang.org/x/oauth2"
	"krishna.assistiveball.io/internals/models"
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

type ReminderJson struct {
	Title      string    `json:"title"`
	RemindTime time.Time `json:"remind_time"`
	Todo       string    `json:"todo"`
	Apps       []string  `json:"apps"`
	Frequency  string    `json:"frequency"`
	CreatedBy  string
}

type TaskJson struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Reminders   []string  `json:"reminders"`
	Apps        []string  `json:"apps"`
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
	id, err := app.userModel.InsertUser(jsonResponse.Name, jsonResponse.Picture, jsonResponse.Email)
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

func (app *App) AddTodo(res http.ResponseWriter, req *http.Request) {
	userId, err := app.SessionManager.ValidateUser(req.Context(), req)
	if err != nil {
		ErrorLog.Printf("FAILED TO GET USERID %v", err)
		http.Error(res, "Not Authorized", http.StatusUnauthorized)
		return
	}
	task := TaskJson{}
	err = json.NewDecoder(req.Body).Decode(&task)
	if err != nil {
		ErrorLog.Print("FAILED TO DECODE THE REQUEST BODY")
		http.Error(res, "Failed to decode the request body", http.StatusInternalServerError)
		return
	}
	id, err := app.taskModel.Insert(task.Title, task.Description, userId, task.Reminders, task.Apps, task.StartTime, task.EndTime)
	if err != nil {
		ErrorLog.Printf("FAILED TO INSERT TASK %v", err)
		http.Error(res, "Failed to insert task", http.StatusInternalServerError)
		return
	}
	type Response struct {
		Success bool
		Message string
		Id      string
	}
	rawResponse := &Response{
		Success: true,
		Message: "Successfully Added Task",
		Id:      id,
	}
	jsonResponse, err := json.Marshal(rawResponse)
	if err != nil {
		ErrorLog.Printf("FAILED TO PARSE RESPONSE %v", err)
		http.Error(res, "Failed to parse response", http.StatusInternalServerError)
		return
	}
	res.WriteHeader(201)
	res.Write(jsonResponse)
}
func (app *App) GetReminders(res http.ResponseWriter, req *http.Request) {
	todoId := req.URL.Query().Get("todoId")
	InfoLog.Printf("TODO ID IS %v", todoId)
	userId, err := app.SessionManager.ValidateUser(req.Context(), req)
	InfoLog.Printf("UserId IS %v", userId)
	if userId == "" {
		http.Error(res, "Un Authorized", http.StatusUnauthorized)
		return
	}
	if err != nil {
		ErrorLog.Printf("Error While Parsing Token %v", err)
		http.Error(res, "Un Authorized", http.StatusUnauthorized)
		return
	}

	if todoId == "" {
		InfoLog.Print("REACHED HERE")
		var reminders []models.Reminder
		reminders, err = app.reminderModel.GetReminders(userId)
		if err != nil {
			ErrorLog.Printf("Failed to get reminders %v", err)
			http.Error(res, "Failed to get reminders", http.StatusInternalServerError)
			return
		}
		type Response struct {
			Success   bool
			Message   string
			Reminders []models.Reminder
		}

		responseToReturn := Response{
			Success:   true,
			Message:   "Fetched Reminders Successfully",
			Reminders: reminders,
		}
		responseToReturnJSON, err := json.Marshal(responseToReturn)
		if err != nil {
			ErrorLog.Printf("Failed to parse response %v", err)
			http.Error(res, "Failed to parse response", http.StatusInternalServerError)
			return
		}
		res.Write(responseToReturnJSON)
	} else {
		reminders, err := app.taskModel.GetAllReminders(todoId)
		if err != nil {
			ErrorLog.Printf("FAILED TO GET REMINDERS FOR TASK %v, ERROR : %v", todoId, err)
			http.Error(res, fmt.Sprintf("FAILED TO GET REMINDERS FOR TASK %v", todoId), http.StatusBadGateway)
			return
		}
		type Response struct {
			Success   bool
			Message   string
			Reminders []models.ReminderWithNull
		}

		responseToReturn := Response{
			Success:   true,
			Message:   "Fetched Reminders Successfully",
			Reminders: reminders,
		}
		responseToReturnJSON, err := json.Marshal(responseToReturn)
		if err != nil {
			ErrorLog.Printf("Failed to parse response %v", err)
			http.Error(res, "Failed to parse response", http.StatusInternalServerError)
			return
		}
		res.Write(responseToReturnJSON)

	}

}

func (app *App) AddReminder(res http.ResponseWriter, req *http.Request) {
	userId, err := app.SessionManager.ValidateUser(req.Context(), req)
	if err != nil {
		ErrorLog.Printf("FAILED TO GET USERID %v", err)
		http.Error(res, "Not Authorized", http.StatusUnauthorized)
		return
	}
	reminder := ReminderJson{}
	err = json.NewDecoder(req.Body).Decode(&reminder)
	if err != nil {
		ErrorLog.Print("FAILED TO DECODE THE REQUEST BODY")
		http.Error(res, "Failed to decode the request body", http.StatusInternalServerError)
		return
	}
	var id string
	if reminder.Todo != "" {
		valid, err := app.taskModel.TaskExists(reminder.Todo)
		if err != nil {
			ErrorLog.Printf("FAILED TO INSERT Reminder %v", err)
			http.Error(res, "Failed to insert reminder", http.StatusInternalServerError)
			return
		}
		InfoLog.Printf("TODO VALID %v", valid)
		if valid {

			id, err = app.reminderModel.WithTodo(reminder.Title, reminder.Todo, userId, reminder.Apps, reminder.RemindTime)
			if err != nil {
				ErrorLog.Printf("FAILED TO INSERT Reminder %v", err)
				http.Error(res, "Failed to insert reminder", http.StatusInternalServerError)
				return
			}
		} else {
			ErrorLog.Printf("INVALID TODO PROVIDED %v", reminder.Todo)
			http.Error(res, "INVALID TODO PROVIDED ", http.StatusInternalServerError)
			return
		}
	} else {
		id, err = app.reminderModel.SetReminder(reminder.Title, reminder.Frequency, userId, reminder.Apps, reminder.RemindTime)
		if err != nil {
			ErrorLog.Printf("FAILED TO INSERT Reminder %v", err)
			http.Error(res, "Failed to insert reminder", http.StatusInternalServerError)
			return
		}

	}
	type Response struct {
		Success bool
		Message string
		Id      string
	}
	rawResponse := &Response{
		Success: true,
		Message: "Successfully Added Reminder",
		Id:      id,
	}
	jsonResponse, err := json.Marshal(rawResponse)
	if err != nil {
		ErrorLog.Printf("FAILED TO PARSE RESPONSE %v", err)
		http.Error(res, "Failed to parse response", http.StatusInternalServerError)
		return
	}
	res.WriteHeader(201)
	res.Write(jsonResponse)
}
