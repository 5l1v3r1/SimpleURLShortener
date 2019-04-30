// Cargar modulos y crear nueva aplicacion
var express = require("express"); 
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // soporte para bodies codificados en jsonsupport
app.use(bodyParser.urlencoded({ extended: true })); // soporte para bodies codificados
var path = require('path');
app.use(express.static('public'));

const mariadb = require('mariadb');
var pool = mariadb.createPool({
	host: 'host',
	port: 'port',
	user: 'user',
	password: 'password',
	database: 'database'
});

var crypto = require('crypto');

const IP = "localhost"; // IP where express will run
const PORT = 8080;		// PORT where express will run

// ************************************************** //
// ********************* FUNCTIONS ****************** //
// ************************************************** //

const isValidUrl = (string) => {
	var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
	'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
	'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
	'(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
	'(\\#[-a-z\\d_]*)?$','i'); // fragment locator
	return !!pattern.test(string);
}


// ************************************************** //
// *************** ROUTE ENDPOINTS ****************** //
// ************************************************** //

pool.getConnection()
	.then(conn => {
		function getURL(hash) {
			return conn.query({
				rowsAsArray: true,
				sql: "SELECT url FROM urls WHERE hash = ?"
			}, [hash])
		}

		function checkURL(url) {
			return conn.query({
				rowsAsArray: true,
				sql: "SELECT hash FROM urls WHERE url = ?"
			}, [url])
		}
		app.get('/shorten', function(req, res, next) {
			let hash = req.query.hash;
			if (!hash) {
				res.sendFile(path.join(__dirname + '/shorten.html'));
			} else {
				let url;
				getURL(hash)
					.then((data) => {
						if (data[0]) {
							url = data[0][0];
						}

						if (url) res.status(301).redirect(url);
						else res.status(401, "Hash not found");
					});
			}
			
		});

		app.post('/newurl', function(req, res, next) {
			let url = req.body["url"];
			let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			let hash;
			if (isValidUrl(url)) {
				checkURL(url)
					.then((data) => {
						if (data[0]) {
							hash = data[0][0];
						}

						if (hash) res.status(200).send(hash);
						else {
							hash = crypto.createHash('sha256').update(url + (+ new Date())).digest("hex").substring(0, 9);

							conn.query({
								rowsAsArray: true,
								sql: 'INSERT INTO urls (hash, url, ip) VALUES (?, ?, ?);'
							}, [hash, url, ip])
								.then(() => {
									res.status(200).send(hash);
								});
						}
					});
				
			} else {
				res.status(200).send("lmao"); // Return lmao for an attempt of sending a "fake" URL
			}
		});

		var server = app.listen(PORT, IP, function () {
			console.log('Server is running..'); 
		});

		setInterval(function() {
			conn.query("SELECT 1"); // pool keep-alive
		}, 60000)
	});
