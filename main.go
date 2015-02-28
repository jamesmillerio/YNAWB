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
	"log"
	"net/http"
	"strconv"
	"strings"
)

func main() {

	//Set our environment
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
	server.Use(sessions.Sessions("ynawb", store))
	server.Use(martini.Static(config.Server.WebRoot))

	//Configure the Martini router
	server.MapTo(router, (*martini.Routes)(nil))
	server.Action(router.Handle)

	//Redirects the users over to Dropbox for authentication
	router.Get("/auth", func(res http.ResponseWriter, req *http.Request) {

		/* So, this is a weird edge case. Because we're serving most
		 * of our app via the static files handler and the HTTPS redirect
		 * in the martinin-contrib/secure package only works for defined routes,
		 * any of our main files own't get redirected. Because of that, we're
		 * going to redirect people when they go to auth their Dropbox
		 * accounts. This should fix the issue. */
		if strings.ToLower(req.URL.Scheme) == "http" && strings.ToLower(req.URL.Host) != "localhost" {

			url := req.URL
			url.Scheme = "https"
			url.Host = req.Host

			http.Redirect(res, req, url.String(), http.StatusFound)

		} else {

			// Redirect user to consent page to ask for permission
			// for the scopes specified above.
			url := oAuthConf.AuthCodeURL("state")

			http.Redirect(res, req, url, http.StatusFound)
		}

	})

	/* Accepts the response after authorizing with Dropbox. */
	router.Get("/auth/response", func(res http.ResponseWriter, req *http.Request) {

		//If they cancelled their login, redirect them back to the home page.
		if authError := req.FormValue("error"); authError != "" {
			http.Redirect(res, req, config.Server.HostName, http.StatusFound)
			return
		}

		code := req.FormValue("code")

		//If we didn't somehow get an authentication code, take them back home.
		if code == "" {
			http.Redirect(res, req, config.Server.HostName, http.StatusFound)
			return
		}

		token, err := oAuthConf.Exchange(nil, code)

		//If our token exchange doesn't work, throw an error and go to our error page.
		if err != nil {
			handleError(err, res, req, config)
			return
		}

		session, err := store.Get(req, "ynawb")

		//If we can't get our session store, throw an error and go to our error page.
		if err != nil {
			handleError(err, res, req, config)
			return
		}

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

	/* Retrieves a list of the users YNAB budgets and devices from
	 * their Dropbox account. Redirects them back to the home page if
	 * their cookie has expired. */
	router.Get("/api/budgets", func(res http.ResponseWriter, req *http.Request) {

		session, _ := store.Get(req, "ynawb")
		cookie := session.Values["token"]

		if token, ok := cookie.(string); ok {

			db.SetAccessToken(token)

			if file, err := loadDropboxFile("/.ynabSettings.yroot", db); err != nil && err.Error() != "EOF" {

				handleError(err, res, req, config)

			} else {

				settings := LoadYNABSettings(file)
				results := make(map[string][]map[string]string)

				for _, setting := range settings.RelativeKnownBudgets {

					bm, err := loadDropboxFile(setting+"/Budget.ymeta", db)

					if err != nil && err.Error() != "EOF" {
						handleError(err, res, req, config)
						return
					}

					metadata := LoadYNABBudgetMetadata(bm)
					devicesPath := setting + "/" + metadata.RelativeDataFolderName + "/devices"
					entries, err := db.Search(devicesPath, ".ydevice", 0, false)

					if err != nil && err.Error() != "EOF" {
						handleError(err, res, req, config)
						return
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

			http.Redirect(res, req, config.Server.HostName, http.StatusUnauthorized)
			return

		}

	})

	/* Retrieves the users YNAB budget data from their Dropbox account.
	 * Redirects them back to the home page if their cookie has expired. */
	router.Get("/api/budgetdata/:budget/:path", func(res http.ResponseWriter, req *http.Request, params martini.Params) string {

		//Do some checks on our parameters
		if params["budget"] == "" || params["budget"] == "undefined" {
			return ""
		}

		if params["path"] == "" || params["path"] == "undefined" {
			return ""
		}

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

			http.Redirect(res, req, config.Server.HostName, http.StatusUnauthorized)

			return ""

		}

	})

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

/* Retrieves files from the users Dropbox. Returns a byte
 * array of the files contents. */
func loadDropboxFile(path string, db *dropbox.Dropbox) ([]byte, error) {

	closer, _, err := db.Download(path, "", 0)

	if err != nil {

		fmt.Printf("Error loading dropbox file: %v\n", err)
		return nil, err

	}

	file, err := ioutil.ReadAll(closer)

	return file, err

}

/* A helper method to handle any errors. Redirects the user
 * to the specified URL on error. */
func handleError(err error, res http.ResponseWriter, req *http.Request, config Configuration) {

	//Print errors
	fmt.Printf("Error: %v\n", err)

	//Get our error file
	url := config.Server.HostName

	if !strings.HasPrefix(config.Server.ErrorFile, "/") {
		url += "/"
	}

	url += config.Server.ErrorFile

	//There's been an error redirect to the home page.
	http.Redirect(res, req, url, http.StatusInternalServerError)
}
