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

app._storeCred = function(provider, _cred, opt) {
  return new Promise(function(resolve, reject) {
    var cred = null;
    if (app.cmaEnabled) {
      switch (provider) {
        case PASSWORD_LOGIN:
          cred = new PasswordCredential({
            id: opt.id,
            password: opt.password
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

app._authFlow = function(provider, form) {
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
      body: form
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

app.gSignIn = function(id) {
  var auth2 = gapi.auth2.getAuthInstance();
  return auth2.signIn({
    login_hint: id || ''
  }).then(function(googleUser) {
    form = new FormData();
    form.append('id_token', googleUser.getAuthResponse().id_token);
    return app._authFlow(GOOGLE_SIGNIN, form);
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
      return app._authFlow(FACEBOOK_LOGIN, form);
    } else {
      reject();
    }
  });
};

app.pwSignIn = function(cred) {
  return app._authFlow(PASSWORD_LOGIN, cred);
};

app.onRegister = function() {
  var that = this;
  var form = new FormData(document.querySelector('#regForm'));
  var opt = {
    id: document.querySelector('#email').value,
    name: document.querySelector('#name').value,
    password: document.querySelector('#password').value
  }
  app._storeCred(PASSWORD_LOGIN, form, opt).then(function() {
    fetch('/register', {
      method: 'POST',
      body: form
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
  fetch('/unregister', {
    method: 'POST',
    body: form
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

app.onPwSignIn = function() {
  var form = new FormData(this.$.form);
  var opt = {
    id: document.querySelector('#lemail').value,
    password: document.querySelector('#lpassword').value
  }
  app._storeCred(PASSWORD_LOGIN, form, opt).then(function() {
    app.pwSignIn(form);
  });
};

app.onGSignIn = function() {
  app.gSignIn().then(function(profile) {
    app._storeCred(GOOGLE_SIGNIN, profile);
  });
};

app.onFbSignIn = function() {
  app.fbSignIn().then(function(profile) {
    app._storeCred(FACEBOOK_LOGIN, profile);
  });
};

app.signOut = function() {
  fetch('/signout').then(function() {
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
  gapi.auth2.init({
    client_id: '958899272372-k713dk2pdddd4jmqvbqt3oupbg4q3ik3.apps.googleusercontent.com'
  });
  if (app.cmaEnabled) {
    app._autoSignIn(true).then(function() {
      console.log('auto sign-in succeeded.');
    }, function() {
      console.log('auto sign-in was not performed.');
    });
  }
});
