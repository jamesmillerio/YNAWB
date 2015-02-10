package main

import (
	"github.com/go-martini/martini"
	"io/ioutil"
)

func main() {

	//Load our config information and start our web server.
	config := LoadConfiguration("./config.json")
	server := martini.Classic()

	//Set our public web root where our files are served.
	server.Use(martini.Static(config.Server.WebRoot))

	//Add our endpoint to get their YNAB data.
	server.Get("/budgetdata", func() string {

		results, _ := ioutil.ReadFile("/Users/james/Dropbox/YNAB/Bills Budget~5AB20D0F.ynab4/data1~F2813C02/E48B9F31-EAC7-302B-CAB4-4565B0E821FE/Budget.yfull")

		return string(results)

	})

	//Start the server
	server.Run()

}
