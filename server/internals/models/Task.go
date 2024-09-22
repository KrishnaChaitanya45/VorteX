package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

//! Constant statements for DB OPerations

var (
	InsertTask = "INSERT INTO tasks(ID, Title, Description, StartTime, EndTime, Apps, CreatedBy) VALUES ($1, $2, $3, $4, $5, $6, $7)"
	InitTask   = `CREATE TABLE IF NOT EXISTS tasks(
		ID TEXT NOT NULL PRIMARY KEY,
		Title TEXT NOT NULL,
		Description TEXT NOT NULL,
		StartTime TIMESTAMP NOT NULL,
		EndTime TIMESTAMP NOT NULL,
		Apps TEXT[],
		CreatedBy TEXT NOT NULL,
		FOREIGN KEY (CreatedBy) REFERENCES users(ID) ON DELETE CASCADE
	)`
	ExistsTask = "SELECT ID FROM tasks WHERE ID = $1"
)

type Task struct {
	ID          string
	Title       string
	Description string
	StartTime   time.Time
	EndTime     time.Time
	Apps        []string
}

type ReminderWithNull struct {
	ID         string
	Title      sql.NullString
	RemindTime time.Time
	Todo       string
	Apps       []string
	Frequency  sql.NullString
	CreatedBy  string
}

type TaskModel struct {
	DB *sql.DB
}

func (tm *TaskModel) InitTask() error {
	_, err := tm.DB.Exec(InitTask)
	return err
}

func (tm *TaskModel) TaskExists(taskId string) (bool, error) {
	var result bool
	statement := "SELECT EXISTS(SELECT 1 FROM tasks WHERE ID = $1)"
	err := tm.DB.QueryRow(statement, taskId).Scan(&result)
	return result, err
}

func (tm *TaskModel) Insert(Title, Description, CreatedBy string, Reminders, Apps []string, StartTime, EndTime time.Time) (string, error) {
	id := uuid.New().String()
	_, err := tm.DB.Exec(InsertTask, id, Title, Description, StartTime, EndTime, pq.Array(Apps), CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (tm *TaskModel) GetAllReminders(taskId string) ([]ReminderWithNull, error) {
	statement := `
	SELECT r.*
	FROM reminders r
	JOIN tasks t ON r.Todo=t.ID
	WHERE t.ID=$1
	`
	rows, err := tm.DB.Query(statement, taskId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reminders []ReminderWithNull
	for rows.Next() {
		var reminder ReminderWithNull
		if err := rows.Scan(&reminder.ID, &reminder.Title, &reminder.RemindTime, &reminder.Todo, pq.Array(&reminder.Apps), &reminder.Frequency, &reminder.CreatedBy); err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reminders, nil
}

