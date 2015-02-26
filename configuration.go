package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"reflect"
	"strconv"
	"strings"
)

type DropboxConfiguration struct {
	AppKey    string
	AppSecret string
}

type ServerConfiguration struct {
	WebRoot         string
	SessionMaxAge   int
	HostName        string
	Port            int
	PortSSL         int
	CertificatePath string
	KeyPath         string
	ErrorFile       string
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

	env := GetEnvironmentVariables()
	config := Configuration{}

	/* If we're hosting on Heroku, load all
	 * settings from environment variables. */
	if env["IS_HEROKU"] == "true" {

		configValue := reflect.ValueOf(&config).Elem()
		configType := configValue.Type()

		getConfiguration(configType, configValue, "")

		fmt.Printf("Final configuration: %v\n", config)

	} else {

		/* If we're hosting anywhere, just grab
		 * it from our json configuration file. */
		file, e := ioutil.ReadFile(path)

		if e != nil {
			fmt.Printf("Error reading configuration file: %v\n", e)
			os.Exit(1)
		}

		e = json.Unmarshal(file, &config)

		if e != nil {
			fmt.Printf("Error unmarshalling configuration file: %v\n", e)
			os.Exit(1)
		}

	}

	return config
}

func getConfiguration(t reflect.Type, v reflect.Value, parent string) {

	env := GetEnvironmentVariables()

	for i := 0; i < t.NumField(); i++ {

		field := t.Field(i)
		fieldType := field.Type
		fieldValue := v.Field(i)
		key := ""

		if parent == "" {
			key = strings.ToUpper(field.Name)
		} else {
			key = parent + "_" + strings.ToUpper(field.Name)
		}

		value := env[key]

		if value != "" {

			fmt.Printf("key: %v, value: %v\n", key, value)

			switch fieldType.Name() {
			case "string":
				fieldValue.SetString(value)
			case "int":
				if i, err := strconv.Atoi(value); err != nil {
					fieldValue.SetInt(int64(i))
				}
			default:
				getConfiguration(fieldType, fieldValue, key)
			}
		}

	}

}

func GetEnvironmentVariables() map[string]string {

	m := make(map[string]string)

	for _, e := range os.Environ() {

		kv := strings.Split(e, "=")

		m[kv[0]] = kv[1]

	}

	return m

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
