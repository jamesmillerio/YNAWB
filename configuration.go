package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
)

type DropboxConfiguration struct {
	AppKey    string
	AppSecret string
}

type ServerConfiguration struct {
	WebRoot       string
	SessionMaxAge int
	HostName      string
	Port          int
}

type Configuration struct {
	Dropbox DropboxConfiguration
	Server  ServerConfiguration
}

type YNABSettings struct {
	FormatVersion                string
	RelativeKnownBudgets         []string
	TED                          int
	RelativeDefaultBudgetsFolder string
}

type YNABBudgetMetadata struct {
	RelativeDataFolderName string
	TED                    int
	FormatVersion          string
}

type YNABDevice struct {
	DeviceType                 string
	HighestDataVersionImported string
	FriendlyName               string
	KnowledgeInFullBudgetFile  string
	YNABVersion                string
	HasFullKnowledge           bool
	Knowledge                  string
	DeviceGUID                 string
	FormatVersion              string
	ShortDeviceId              string
	LastDataVersionFullyKnown  string
}

func LoadConfiguration(path string) Configuration {

	file, e := ioutil.ReadFile(path)

	if e != nil {
		fmt.Printf("Error reading configuration file: %v\n", e)
		os.Exit(1)
	}

	config := Configuration{}

	e = json.Unmarshal(file, &config)

	if e != nil {
		fmt.Printf("Error unmarshalling configuration file: %v\n", e)
		os.Exit(1)
	}

	return config
}

func LoadYNABSettings(data []byte) YNABSettings {

	settings := YNABSettings{}

	e := json.Unmarshal(data, &settings)

	if e != nil {
		fmt.Printf("Error unmarshalling YNAB settings file: %v\n", e)
		os.Exit(1)
	}

	return settings
}

func LoadYNABBudgetMetadata(data []byte) YNABBudgetMetadata {

	metadata := YNABBudgetMetadata{}

	e := json.Unmarshal(data, &metadata)

	if e != nil {
		fmt.Printf("Error unmarshalling YNAB budget metadata file: %v\n", e)
		os.Exit(1)
	}

	return metadata
}

func LoadYNABDevice(data []byte) YNABDevice {

	device := YNABDevice{}

	e := json.Unmarshal(data, &device)

	if e != nil {
		fmt.Printf("Error unmarshalling YNAB budget metadata file: %v\n", e)
		os.Exit(1)
	}

	return device
}
