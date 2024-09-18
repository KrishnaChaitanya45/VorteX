package models

import (
	"database/sql"

	"github.com/google/uuid"
)

//! Constant statements for DB OPerations

var (
	InsertUser = "INSERT INTO users(ID, Email, UserName, Picture) VALUES ($1, $2, $3, $4)"
	Init       = `CREATE TABLE IF NOT EXISTS users(
		ID TEXT NOT NULL PRIMARY KEY,
		Email TEXT NOT NULL UNIQUE,
		UserName TEXT NOT NULL UNIQUE,
		Picture TEXT NOT NULL
	)`
	ExistsEmail = "SELECT ID FROM users WHERE Email = $1"
)

type User struct {
	ID       string
	Email    string
	UserName string
	Picture  string
}

type UserModel struct {
	DB *sql.DB
}

func (u *UserModel) Init() error {
	_, err := u.DB.Exec(Init)
	return err
}

func (u *UserModel) Exists(Email string) (string, error) {
	var userId string
	err := u.DB.QueryRow(ExistsEmail, Email).Scan(&userId)
	return userId, err
}

func (u *UserModel) Insert(UserName, Picture, Email string) (string, error) {

	var id string
	id, err := u.Exists(Email)
	if err != nil {
		id = uuid.New().String()

		_, err := u.DB.Exec(InsertUser, id, Email, UserName, Picture)
		if err != nil {
			return "", err
		}
		return id, err

	}
	return id, err
}
