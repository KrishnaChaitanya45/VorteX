package models

import "time"

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Notification struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	TodoId         string    `json:"todo_id"`
	ReminderId     string    `json:"reminder_id"`
	RemindTime     time.Time `json:"remind_time"`
	Frequency      string    `json:"frequency"`
	LastRemindedAt time.Time `json:"last_reminded_at"`
}
