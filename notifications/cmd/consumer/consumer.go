// worker.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/IBM/sarama"
	"notifications.assitiveball.io/pkg/models"
)

const (
	KafkaConsumerGroupID = "reminder-group"
	KafkaServerAddress   = "localhost:9092"
	KafkaTopic           = "notifications"
	ReminderAttempts     = 4 // Number of reminder attempts
)

func main() {
	// Initialize Kafka consumer
	consumer, err := initConsumer()
	if err != nil {
		log.Fatalf("Failed to initialize Kafka consumer: %v", err)
	}

	defer func() {
		if err := consumer.Close(); err != nil {
			log.Printf("Failed to close consumer: %v", err)
		}
	}()

	consumeMessages(consumer)
}

// initConsumer initializes the Kafka consumer
func initConsumer() (sarama.ConsumerGroup, error) {
	config := sarama.NewConfig()
	config.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()
	config.Consumer.Offsets.Initial = sarama.OffsetOldest

	consumer, err := sarama.NewConsumerGroup([]string{KafkaServerAddress}, KafkaConsumerGroupID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to start Sarama consumer group: %w", err)
	}
	return consumer, nil
}

// consumeMessages listens for messages from Kafka and spawns goroutines for reminders
func consumeMessages(consumer sarama.ConsumerGroup) {
	ctx := context.Background()

	for {
		err := consumer.Consume(ctx, []string{KafkaTopic}, &consumerHandler{})
		if err != nil {
			log.Printf("Error while consuming messages: %v", err)
		}
	}
}

// consumerHandler handles received Kafka messages
type consumerHandler struct{}

func (ch *consumerHandler) Setup(session sarama.ConsumerGroupSession) error {
	log.Println("Consumer group session setup")
	return nil
}

func (ch *consumerHandler) Cleanup(session sarama.ConsumerGroupSession) error {
	log.Println("Consumer group session cleanup")
	return nil
}

func (ch *consumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		log.Printf("Received message: key=%s, value=%s", string(message.Key), string(message.Value))

		var reminder models.Notification
		if err := json.Unmarshal(message.Value, &reminder); err != nil {
			log.Printf("Failed to unmarshal Kafka message: %v", err)
			continue
		}

		// Spin up a goroutine to handle this reminder without blocking the consumer
		go handleReminder(reminder)

		session.MarkMessage(message, "")
	}
	return nil
}

// handleReminder manages reminder scheduling in a separate goroutine
func handleReminder(reminder models.Notification) {
	now := time.Now()

	// Wait until the reminder time
	if now.Before(reminder.RemindTime) {
		waitDuration := reminder.RemindTime.Sub(now)
		log.Printf("Scheduling reminder in %s (reminder time: %s)", waitDuration, reminder.RemindTime)
		time.Sleep(waitDuration)
	}

	// Send the first notification and schedule repeats based on frequency
	for attempt := 1; attempt <= ReminderAttempts; attempt++ {
		sendNotification(reminder)
		reminder.LastRemindedAt = time.Now()

		// Sleep for the specified frequency before the next reminder
		frequencyDuration := parseFrequency(reminder.Frequency)
		log.Printf("Waiting for next reminder in %s (attempt %d/%d)", frequencyDuration, attempt, ReminderAttempts)
		time.Sleep(frequencyDuration)
	}

	log.Printf("Completed all reminders for: %s", reminder.Title)
}

// sendNotification simulates sending the notification to the Electron app
func sendNotification(reminder models.Notification) {
	log.Printf("Sending notification: Title=%s, Description=%s, Time=%s", reminder.Title, reminder.Description, time.Now())
}

// parseFrequency parses the reminder frequency into time.Duration
func parseFrequency(frequency string) time.Duration {
	duration, err := time.ParseDuration(frequency)
	if err != nil {
		log.Printf("Invalid frequency format: %v", err)
		return time.Minute
	}
	return duration
}
