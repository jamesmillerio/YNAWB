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
	WebRoot string
}

type Configuration struct {
	Dropbox DropboxConfiguration
	Server  ServerConfiguration
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
