package main

import (
	"fmt"
	"github.com/go-martini/martini"
	"github.com/gorilla/securecookie"
	"github.com/martini-contrib/secure"
	"github.com/martini-contrib/sessions"
	"github.com/stacktic/dropbox"
	"github.com/unrolled/render"
	"golang.org/x/oauth2"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func main() {

	martini.Env = martini.Prod

	//Load our config information and start our web server.
	config := LoadConfiguration("./config.json")
	auth, encrypt := securecookie.GenerateRandomKey(64), securecookie.GenerateRandomKey(32)
	store := sessions.NewCookieStore(auth, encrypt)
	server := martini.New()
	db := dropbox.NewDropbox()
	router := martini.NewRouter()
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
	server.Use(martini.Logger())
	server.Use(martini.Recovery())
	server.Use(martini.Static(config.Server.WebRoot))
	server.Use(sessions.Sessions("ynawb", store))

	//Configure the Martini router
	server.MapTo(router, (*martini.Routes)(nil))
	server.Action(router.Handle)

	//Manually serve the main index file so it will reidirect to HTTPS.
	router.Get("/index.html", func(res http.ResponseWriter, req *http.Request) string {

		root := config.Server.WebRoot

		if !strings.HasSuffix(root, "/") {
			root += "/"
		}

		file, err := ioutil.ReadFile(root + "/index.html")

		if err != nil {
			log.Fatal(err)
		}

		return string(file)

	})

	//Redirects the users over to Dropbox for authentication
	router.Get("/auth", func(res http.ResponseWriter, req *http.Request) string {

		// Redirect user to consent page to ask for permission
		// for the scopes specified above.
		url := oAuthConf.AuthCodeURL("state")

		http.Redirect(res, req, url, http.StatusFound)

		return string("")

	})

	//Accepts the response after authorizing via Dropbox
	router.Get("/auth/response", func(res http.ResponseWriter, req *http.Request) {

		authError := req.FormValue("error")

		//If they cancelled their login, redirect them back to the home page.
		if authError != "" {
			http.Redirect(res, req, config.Server.HostName, http.StatusFound)
			return
		}

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
	})

	//Present the list of budgest for the user to select. We're joining a bunch of JSON documents here.
	router.Get("/api/budgets", func(res http.ResponseWriter, req *http.Request) {

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
	router.Get("/api/budgetdata/:budget/:path", func(res http.ResponseWriter, req *http.Request, params martini.Params) string {

		session, _ := store.Get(req, "ynawb")
		cookie := session.Values["token"]

		if token, ok := cookie.(string); ok {

			db.SetAccessToken(token)

			s, err := loadDropboxFile(".ynabSettings.yroot", db)

			if err != nil && err.Error() != "EOF" {
				handleError(err, res, req, config)
			}

			settings := LoadYNABSettings(s)
			relativePath := ""

			for _, p := range settings.RelativeKnownBudgets {

				if strings.Contains(p, params["budget"]) {
					relativePath = p
				}

			}

			path := "/" + relativePath + "/"

			m, err := loadDropboxFile(path+"Budget.ymeta", db)

			if err != nil && err.Error() != "EOF" {
				handleError(err, res, req, config)
			}

			metadata := LoadYNABBudgetMetadata(m)

			budget := path + metadata.RelativeDataFolderName + "/" + params["path"] + "/Budget.yfull"

			b, err := loadDropboxFile(budget, db)

			if err != nil && err.Error() != "EOF" {
				handleError(err, res, req, config)
			}

			res.Header().Set("Content-Type", "application/json")

			return string(b)

		} else {

			http.Redirect(res, req, config.Server.HostName, 200)

			return ""

		}

	})

	//Configure our secure options
	server.Use(secure.Secure(secure.Options{
		SSLRedirect: true,
	}))

	// HTTP
	go func() {

		if err := http.ListenAndServe(":"+strconv.Itoa(config.Server.Port), server); err != nil {
			log.Fatal(err)
		} else {
			fmt.Printf("Listing on port :%v\n", config.Server.Port)
		}
	}()

	server.RunOnAddr(":" + strconv.Itoa(config.Server.PortSSL))
	server.Run()

}

func loadDropboxFile(path string, db *dropbox.Dropbox) ([]byte, error) {

	closer, _, err := db.Download(path, "", 0)

	if err != nil {

		fmt.Printf("Error loading dropbox file: %v\n", err)
		return nil, err

	}

	file, err := ioutil.ReadAll(closer)

	return file, err

}

func handleError(err error, res http.ResponseWriter, req *http.Request, config Configuration) {

	//Print errors
	fmt.Printf("Error: %v\n", err)

	//There's been an error redirect to the home page.
	http.Redirect(res, req, config.Server.HostName, http.StatusFound)
}
