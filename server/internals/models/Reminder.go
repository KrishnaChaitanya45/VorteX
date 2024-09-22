package models

import (
	"database/sql"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

//! Constant statements for DB OPerations

var (
	InsertReminder = "INSERT INTO reminders(ID, Title, RemindTime, Todo, Apps, Frequency, CreatedBy) VALUES ($1, $2, $3, $4, $5, $6, $7)"
	InitReminder   = `CREATE TABLE IF NOT EXISTS reminders(
		ID TEXT NOT NULL PRIMARY KEY,
		Title TEXT,
		RemindTime TIMESTAMP NOT NULL,
		Todo TEXT,
		Apps TEXT[],
		Frequency TEXT,
		CreatedBy TEXT NOT NULL,
		FOREIGN KEY (CreatedBy) REFERENCES users(ID) ON DELETE CASCADE,
		FOREIGN KEY (Todo) REFERENCES tasks(ID) ON DELETE CASCADE
	)`
	ExistsReminder = "SELECT ID FROM reminders WHERE ID = $1"
	GetReminders   = "SELECT ID, Title, RemindTime, Apps, Frequency FROM reminders WHERE CreatedBy = $1"
)

type Reminder struct {
	ID         string
	Title      string
	RemindTime time.Time
	Todo       string
	Apps       []string
	Frequency  string
	CreatedBy  string
}

type ReminderModel struct {
	DB *sql.DB
}

func (rm *ReminderModel) InitReminder() error {
	_, err := rm.DB.Exec(InitReminder)
	return err
}

func (rm *ReminderModel) WithTodo(Title, Todo, CreatedBy string, Apps []string, RemindTime time.Time) (string, error) {
	id := uuid.New().String()
	log.Printf("TRYING TO ADD TODO WITH ID %v", Todo)
	_, err := rm.DB.Exec(InsertReminder, id, "", RemindTime, Todo, pq.Array(Apps), "", CreatedBy)
	if err != nil {
		return "", err
	}
	return id, err

}

func (rm *ReminderModel) SetReminder(Title, Frequency, CreatedBy string, Apps []string, RemindTime time.Time) (string, error) {
	id := uuid.New().String()
	_, err := rm.DB.Exec(InsertReminder, id, Title, RemindTime, nil, pq.Array(Apps), Frequency, CreatedBy)
	if err != nil {
		return "", err
	}
	return id, err
}

func (rm *ReminderModel) GetReminders(userId string) ([]Reminder, error) {
	var reminders []Reminder
	rows, err := rm.DB.Query(GetReminders, userId)
	for rows.Next() {
		var reminder Reminder
		if err := rows.Scan(&reminder.ID, &reminder.Title, &reminder.RemindTime, pq.Array(&reminder.Apps), &reminder.Frequency); err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)

	}
	return reminders, err
}
