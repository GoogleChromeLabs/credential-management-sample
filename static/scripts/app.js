const PASSWORD_LOGIN = 'password';
const GOOGLE_SIGNIN  = 'https://accounts.google.com/';
const FACEBOOK_LOGIN = 'https://www.facebook.com/';
const DEFAULT_IMG    = '/images/default_img.png';

var app = document.querySelector('#app');
app.cmaEnabled = !!navigator.credentials;
app.selected = 0;
app.userProfile = null;
app.listeners = {
  'show-toast': 'showToast'
};

app._storeCred = function(provider, _cred) {
  return new Promise(function(resolve, reject) {
    var cred = null;
    if (app.cmaEnabled) {
      switch (provider) {
        case PASSWORD_LOGIN:
          cred = new PasswordCredential({
            id: _cred.get('email'),
            password: _cred.get('password')
          });
          break;
        case GOOGLE_SIGNIN:
        case FACEBOOK_LOGIN:
          cred = new FederatedCredential({
            id: _cred.email,
            name: _cred.name,
            iconURL: _cred.imageUrl || DEFAULT_IMG,
            provider: provider,
          });
          break;
      }
      navigator.credentials.store(cred).then(function() {
        resolve(_cred);
      }, reject);
    } else {
      resolve(_cred);
    }
  });
};

app._autoSignIn = function(suppressUI) {
  return new Promise(function(resolve, reject) {
    if (app.cmaEnabled) {
      return navigator.credentials.get({
        password: true,
        federated: {
          provider: [GOOGLE_SIGNIN, FACEBOOK_LOGIN]
        },
        suppressUI: suppressUI
      }).then(function(cred) {
        if (cred) {
          switch (cred.type) {
            case 'password':
              cred.idName = 'email';
              return app.pwSignIn(cred);
            case 'federated':
              switch (cred.provider) {
                case GOOGLE_SIGNIN:
                  return app.gSignIn(cred.id);
                case FACEBOOK_LOGIN:
                  return app.fbSignIn();
              }
              break;
          }
        } else {
          reject();
        }
      });
    } else {
      reject();
    }
  });
};

app._authFlow = function(provider, cred) {
  return new Promise(function(resolve, reject) {
    var url = '';
    switch (provider) {
      case FACEBOOK_LOGIN:
        url = '/auth/facebook';
        break;
      case GOOGLE_SIGNIN:
        url = '/auth/google';
        break;
      case PASSWORD_LOGIN:
        url = '/auth/password';
        break;
    }
    return fetch(url, {
      method: 'POST',
      body: cred,
      credentials: 'include'
    }).then(function(res) {
      return res.json();
    }).then(function(profile) {
      return app.signedIn(profile);
    }).then(function(profile) {
      resolve(profile);
    }, function(e) {
      app.fire('show-toast', {
        text: 'Authentication failed'
      });
    });
  });
};

app.onPwSignIn = function() {
  var form = new FormData(this.$.form);
  app._storeCred(PASSWORD_LOGIN, form).then(function() {
    app.pwSignIn(form);
  });
};

app.pwSignIn = function(cred) {
  // Include CSRF token in the credential object
  var csrf_token = new FormData();
  csrf_token.append('csrf_token', document.querySelector('#csrf_token').value);
  cred.additionalData = csrf_token;
  return app._authFlow(PASSWORD_LOGIN, cred);
};

app.onGSignIn = function() {
  app.gSignIn().then(function(profile) {
    app._storeCred(GOOGLE_SIGNIN, profile);
  });
};

app.gSignIn = function(id) {
  var auth2 = gapi.auth2.getAuthInstance();
  return auth2.signIn({
    login_hint: id || ''
  }).then(function(googleUser) {
    form = new FormData();
    form.append('id_token', googleUser.getAuthResponse().id_token);
    form.append('csrf_token', document.querySelector('#csrf_token').value);
    return app._authFlow(GOOGLE_SIGNIN, form);
  });
};

app.onFbSignIn = function() {
  app.fbSignIn().then(function(profile) {
    app._storeCred(FACEBOOK_LOGIN, profile);
  });
};

app.fbSignIn = function() {
  return (function() {
    return new Promise(function(resolve, reject) {
      FB.getLoginStatus(function(res) {
        if (res.status == 'connected') {
          resolve(res);
        } else {
          FB.login(resolve);
        }
      });
    });
  })().then(function(res) {
    if (res.status == 'connected') {
      var form = new FormData();
      form.append('access_token', res.authResponse.accessToken);
      form.append('csrf_token', document.querySelector('#csrf_token').value);
      return app._authFlow(FACEBOOK_LOGIN, form);
    } else {
      reject();
    }
  });
};

app.onRegister = function() {
  var that = this;
  var form = new FormData(document.querySelector('#regForm'));
  app._storeCred(PASSWORD_LOGIN, form).then(function() {
    form.append('csrf_token', document.querySelector('#csrf_token').value);
    fetch('/register', {
      method: 'POST',
      body: form,
      credentials: 'include'
    }).then(function(res) {
      if (res.status == 200) {
        return res.json();
      } else {
        throw 'Response code: ' + res.status;
      }
    }).then(function(profile) {
      if (profile && profile.name && profile.email) {
        that.fire('show-toast', {
          text: 'Thanks for signing up!'
        });
        app.userProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          imageUrl: profile.imageUrl || DEFAULT_IMG
        };
        that.$.dialog.close();
      } else {
        throw 'Authentication failed';
      }
    }).catch(function(e) {
      that.fire('show-toast', {
        text: e
      });
    });
  });
};

app.onUnregister = function() {
  var form = new FormData();
  form.append('id', app.userProfile.id);
  form.append('csrf_token', document.querySelector('#csrf_token').value);
  fetch('/unregister', {
    method: 'POST',
    body: form,
    credentials: 'include'
  }).then(function(res) {
    if (res.status != 200) {
      throw 'Could not unregister';
    }
    if (app.cmaEnabled) {
      navigator.credentials.requireUserMediation();
    }
    app.userProfile = null;
    app.fire('show-toast', {
      text: "You're unregistered."
    });
    app.selected = 0;
  }).catch(function(e) {
    app.fire('show-toast', {
      text: e
    });
  });
};

app.signOut = function() {
  fetch('/signout', {
    credentials: 'include'
  }).then(function() {
    if (app.cmaEnabled) {
      navigator.credentials.requireUserMediation();
    }
    app.userProfile = null;
    app.fire('show-toast', {
      text: "You're signed out."
    });
  });
};

app.signedIn = function(res) {
  return new Promise(function(resolve, reject) {
    if (res && res.name && res.email) {
      app.fire('show-toast', {
        text: "You're signed in."
      });
      app.userProfile = {
        id: res.id,
        name: res.name,
        email: res.email,
        imageUrl: res.imageUrl || DEFAULT_IMG
      };
      app.$.dialog.close();
      resolve(res);
    } else {
      reject('Authentication failed');
    }
  });
};

app.showToast = function(e) {
  this.$.toast.text = e.detail.text;
  this.$.toast.show();
};

app.openDialog = function() {
  app._autoSignIn(false).catch(function() {
    app.$.dialog.open();
  });
};

// Initialise Facebook Login
FB.init({
  appId: '705099176296510',
  cookie: true,
  xfbml: false,
  version: 'v2.5'
});

// Initialise Google Sign-In
gapi.load('auth2', function() {
  gapi.auth2.init();
  if (app.cmaEnabled) {
    app._autoSignIn(true).then(function() {
      console.log('auto sign-in succeeded.');
    }, function() {
      console.log('auto sign-in was not performed.');
    });
  }
});
