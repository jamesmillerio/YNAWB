package main

import (
	"fmt"
	"github.com/go-martini/martini"
	"github.com/gorilla/securecookie"
	"github.com/martini-contrib/sessions"
	"github.com/stacktic/dropbox"
	"github.com/unrolled/render"
	"golang.org/x/oauth2"
	"io/ioutil"
	"net/http"
)

func main() {

	//Load our config information and start our web server.
	config := LoadConfiguration("./config.json")
	auth, encrypt := securecookie.GenerateRandomKey(64), securecookie.GenerateRandomKey(32)
	store := sessions.NewCookieStore(auth, encrypt)
	server := martini.Classic()
	db := dropbox.NewDropbox()
	r := render.New()
	oAuthConf := &oauth2.Config{
		ClientID:     config.Dropbox.AppKey,
		ClientSecret: config.Dropbox.AppSecret,
		RedirectURL:  config.Server.HostName + "/auth/response",
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://www.dropbox.com/1/oauth2/authorize",
			TokenURL: "https://api.dropbox.com/1/oauth2/token",
		},
	}

	//Configure our Dropbox access
	db.SetAppInfo(config.Dropbox.AppKey, config.Dropbox.AppSecret)

	//Set our public web root and our session storage.
	server.Use(martini.Static(config.Server.WebRoot))
	server.Use(sessions.Sessions("ynawb", store))

	//Redirects the users over to Dropbox for authentication
	server.Get("/auth", func(res http.ResponseWriter, req *http.Request) string {

		//Configure Dropbox

		// Redirect user to consent page to ask for permission
		// for the scopes specified above.
		url := oAuthConf.AuthCodeURL("state")
		//fmt.Printf("Visit the URL for the auth dialog: %v", url)

		http.Redirect(res, req, url, http.StatusFound)

		return string("")

	})

	//Accepts the response after authorizing via Dropbox
	server.Get("/auth/response", func(res http.ResponseWriter, req *http.Request) {

		code := req.FormValue("code")
		token, _ := oAuthConf.Exchange(nil, code)
		session, _ := store.Get(req, "ynawb")

		//Set our dropbox session token and save.
		session.Options.HttpOnly = true

		//Sets the max age of our cookie. Defaults is fifteen minutes.
		session.Options.MaxAge = config.Server.SessionMaxAge

		//Set our token
		session.Values["token"] = token.AccessToken

		//Save our token and its settings
		session.Save(req, res)

		url := config.Server.HostName + "/budgets"

		//Redirect them to a page where they can select their needed budget
		http.Redirect(res, req, url, http.StatusFound)

		//return string("Redirecting...")
	})

	//Present the list of budgest for the user to select. We're joining a bunch of JSON documents here.
	server.Get("/api/budgets", func(res http.ResponseWriter, req *http.Request) {

		session, _ := store.Get(req, "ynawb")
		cookie := session.Values["token"]

		if token, ok := cookie.(string); ok {

			db.SetAccessToken(token)

			file, err := loadDropboxFile("/.ynabSettings.yroot", db)

			if err != nil && err.Error() != "EOF" {

				handleError(err, res, req, config)

			} else {

				settings := LoadYNABSettings(file)
				results := make(map[string][]map[string]string)

				for _, setting := range settings.RelativeKnownBudgets {

					bm, err := loadDropboxFile(setting+"/Budget.ymeta", db)

					if err != nil && err.Error() != "EOF" {
						handleError(err, res, req, config)
					}

					metadata := LoadYNABBudgetMetadata(bm)
					devicesPath := setting + "/" + metadata.RelativeDataFolderName + "/devices"
					entries, err := db.Search(devicesPath, ".ydevice", 0, false)

					if err != nil && err.Error() != "EOF" {
						handleError(err, res, req, config)
					}

					devicesCollection := make([]map[string]string, len(entries))

					for j, entry := range entries {

						dev, err := loadDropboxFile(entry.Path, db)

						if err != nil && err.Error() != "EOF" {
							handleError(err, res, req, config)
						}

						device := LoadYNABDevice(dev)

						devicesCollection[j] = map[string]string{
							"name": device.FriendlyName,
							"guid": device.DeviceGUID,
						}

					}

					results[setting] = devicesCollection

				}

				res.Header().Set("Content-Type", "application/json")

				r.JSON(res, http.StatusOK, results)
			}

		} else {

			http.Redirect(res, req, config.Server.HostName, 200)

		}

	})

	//Add our endpoint to get their YNAB data.
	server.Get("/api/budgetdata", func(res http.ResponseWriter, req *http.Request) string {

		budget, _ := ioutil.ReadFile("/Users/james/Dropbox/YNAB/Bills Budget~5AB20D0F.ynab4/data1~F2813C02/E48B9F31-EAC7-302B-CAB4-4565B0E821FE/Budget.yfull")

		return string(budget)

	})

	//Start the server
	server.Run()

}

func loadDropboxFile(path string, db *dropbox.Dropbox) ([]byte, error) {

	closer, size, _ := db.Download(path, "", 0)

	file := make([]byte, size)
	_, err := closer.Read(file)

	return file, err

}

func handleError(err error, res http.ResponseWriter, req *http.Request, config Configuration) {

	//Print errors
	fmt.Printf("Error: %v\n", err)

	//There's been an error redirect to the home page.
	http.Redirect(res, req, config.Server.HostName, http.StatusFound)
}
