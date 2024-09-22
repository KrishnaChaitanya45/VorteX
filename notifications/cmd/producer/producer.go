// producer.go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/IBM/sarama"
	"notifications.assitiveball.io/pkg/models"
)

const (
	ProducerPort       = ":8080"
	KafkaServerAddress = "localhost:9092"
	KafkaTopic         = "notifications"
)

func main() {
	// Initialize Kafka producer
	producer, err := initProducer()
	if err != nil {
		log.Fatalf("Unable to initialize Kafka producer: %v", err)
	}

	// HTTP endpoint to create reminders
	http.HandleFunc("/create-reminder", func(w http.ResponseWriter, req *http.Request) {
		handleCreateReminder(producer, w, req)
	})

	log.Printf("Producer running on port %s\n", ProducerPort)
	log.Fatal(http.ListenAndServe(ProducerPort, nil))
}

// initProducer initializes the Kafka producer
func initProducer() (sarama.SyncProducer, error) {
	config := sarama.NewConfig()
	config.Producer.RequiredAcks = sarama.WaitForAll
	config.Producer.Retry.Max = 5
	config.Producer.Return.Successes = true

	producer, err := sarama.NewSyncProducer([]string{KafkaServerAddress}, config)
	if err != nil {
		return nil, fmt.Errorf("failed to start Sarama producer: %w", err)
	}
	return producer, nil
}

// handleCreateReminder handles the HTTP request to create a reminder
func handleCreateReminder(producer sarama.SyncProducer, w http.ResponseWriter, req *http.Request) {
	var reminder models.Notification
	if err := json.NewDecoder(req.Body).Decode(&reminder); err != nil {
		log.Printf("INVALID REQUEST PAYLOAD %v", err)
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	reminder.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	reminder.LastRemindedAt = time.Now()

	// Marshal reminder into JSON for Kafka message
	message, err := json.Marshal(reminder)
	if err != nil {
		http.Error(w, "Failed to serialize reminder", http.StatusInternalServerError)
		return
	}

	// Send the message to Kafka
	kafkaMessage := &sarama.ProducerMessage{
		Topic: KafkaTopic,
		Value: sarama.ByteEncoder(message),
	}

	partition, offset, err := producer.SendMessage(kafkaMessage)
	if err != nil {
		http.Error(w, "Failed to send message to Kafka", http.StatusInternalServerError)
		return
	}

	log.Printf("Reminder sent to Kafka: partition=%d, offset=%d\n", partition, offset)
	w.WriteHeader(http.StatusCreated)
	fmt.Fprintf(w, "Reminder created: %s", reminder.ID)
}
