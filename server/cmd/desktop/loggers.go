package main

import (
	"log"
	"os"
)

var ErrorLog = log.New(os.Stderr, "ERROR :\t", log.Ldate|log.Ltime|log.Lshortfile)
var InfoLog = log.New(os.Stdout, "INFO :\t", log.Ldate|log.Ltime|log.Lshortfile)
