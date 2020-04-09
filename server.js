const express = require('express');
const cookieParser = require('cookie-parser');
const hbs = require('hbs');
const auth = require('./lib/auth');
const app = express();

app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.set('views', './templates');
app.use(cookieParser());
app.use(express.json());
app.use(express.static('src'));

// app.use((req, res, next) => {
//   // CSRF Protection
// });

app.get('/', (req, res) => {
  // TODO: Serve the template
  res.render('index.html', {
    FACEBOOK_APPID: 'abc',
    client_id: 'abc'
  })
});

app.post('/auth/password', (req, res) => {
  const email = req.body.email || '';
  const password = req.body.password || '';

  if (!email || !password) {
    return res.sendStatus(400);
  }

  // const user = db.get('users')
  //   .find({ username: email })
  //   .value();

  // # If the profile doesn't exist, fail.
  // if profile is None:
  //     return make_response('Authentication failed.', 401)

  // # If the password doesn't match, fail.
  // if CredentialStore.verify(password, profile['password']) is False:
  //     return make_response('Authentication failed.', 401)

  // # Get rid of password from profile
  // profile.pop('password')

  // # Not making a session for demo purpose/simplicity
  // return make_response(json.dumps(profile), 200)
});

app.post('/auth/google', (req, res) => {
});

app.post('/auth/facebook', (req, res) => {
});

app.post('/register', (req, res) => {
});

app.post('/unregister', (req, res) => {
});

app.post('/signout', (req, res) => {

});

const port = process.env.PORT || 8080;
const listener = app.listen(port, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
