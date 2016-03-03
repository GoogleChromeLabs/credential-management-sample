/**
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var FB_APPID       = '705099176296510';
var PASSWORD_LOGIN = 'password';
var GOOGLE_SIGNIN  = 'https://accounts.google.com';
var FACEBOOK_LOGIN = 'https://www.facebook.com';
var DEFAULT_IMG    = '/images/default_img.png';

/*
  Although this sample app is using Polymer, most of the interactions are
  handled using regular APIs so you don't have to learn about it.
 */
var app = document.querySelector('#app');
app.cmaEnabled = !!navigator.credentials;
// `selected` is used to show a portion of our page
app.selected = 0;
// User profile automatically show up when an object is set.
app.userProfile = null;
// Set an event listener to show a toast. (Polymer)
app.listeners = {
  'show-toast': 'showToast'
};

/**
 * Store credential information using Credential Management API
 * @param  {String} provider Credential type string.
 * @param  {FormData|Object} _cred FormData or JS Object that contains
 *                                 credential information.
 * @return {Promise} Resolves when stored, rejects when skipped.
 */
app._storeCredential = function(provider, _cred) {
  return new Promise(function(resolve, reject) {
    var cred = null;
    // Is Credential Management API available?
    if (app.cmaEnabled) {
      switch (provider) {
        // If trying to store id/password
        case PASSWORD_LOGIN:
          // Create `Credential` object for password
          cred = new PasswordCredential({
            id:       _cred.get('email'),
            password: _cred.get('password'),
            name:     _cred.get('name') || ''
          });
          break;
        // If trying to store Google Sign-In credential
        case GOOGLE_SIGNIN:
        // If trying to store Facebook Login credential
        case FACEBOOK_LOGIN:
          // Create `Credential` object for federation
          cred = new FederatedCredential({
            id:       _cred.email,
            name:     _cred.name,
            iconURL:  _cred.imageUrl || DEFAULT_IMG,
            provider: provider,
          });
          break;
      }
      // Actual storing operation
      navigator.credentials.store(cred).then(function() {
        resolve(_cred);
      }, reject);
    } else {
      // If Credential Management API is not available, just resolve.
      resolve(_cred);
    }
  });
};

/**
 * Let users sign-in without typing credentials
 * @param  {Boolean} unmediated Determines if user mediation is required.
 * @return {Promise} Resolves if credential info is available.
 */
app._autoSignIn = function(unmediated) {
  return new Promise(function(resolve, reject) {
    if (app.cmaEnabled) {
      // Actual Credential Management API call to get credential object
      return navigator.credentials.get({
        password: true,
        federated: {
          providers: [GOOGLE_SIGNIN, FACEBOOK_LOGIN]
        },
        unmediated: unmediated
      }).then(function(cred) {
        // If credential object is available
        if (cred) {
          switch (cred.type) {
            case 'password':
              // Change form `id` name to `email`
              cred.idName = 'email';
              // Include CSRF token in the credential object
              var csrf_token = new FormData();
              csrf_token.append('csrf_token',
                  document.querySelector('#csrf_token').value);
              // Note `.additionalData` accepts `FormData` which
              // typically includes the CSRF token.
              cred.additionalData = csrf_token;
              // Return Promise from `pwSignIn`
              return app.pwSignIn(cred);
            case 'federated':
              switch (cred.provider) {
                case GOOGLE_SIGNIN:
                  // Return Promise from `gSignIn`
                  return app.gSignIn(cred.id);
                case FACEBOOK_LOGIN:
                  // Return Promise from `fbSignIn`
                  return app.fbSignIn();
              }
              break;
          }
        } else {
          // Reject if credential object is not available
          reject();
        }
      });
    } else {
      // Reject if Credential Management API is not available
      reject();
    }
  });
};

/**
 * Authentication flow with our own server
 * @param  {String} provider Credential type string.
 * @param  {FormData|CredentialObject} cred FormData or CredentialObject
 * @return {Promise} Resolves when successfully authenticated
 */
app._authenticateWithServer = function(provider, cred) {
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
    // POST-ing credential object will be converted to FormData object
    return fetch(url, {
      method:       'POST',
      body:         cred,
      // `credentials:'include'` is required to include cookie on `fetch`
      credentials:  'include'
    }).then(function(res) {
      // Convert JSON string to an object
      return res.json();
    }).then(function(profile) {
      // User is now signed in
      return app.signedIn(profile);
    }).then(function(profile) {
      // Done. Resolve.
      resolve(profile);
    }, function(e) {
      // Polymer event to notice user that 'Authentication failed'.
      app.fire('show-toast', {
        text: 'Authentication failed'
      });
    });
  });
};

/**
 * When password sign-in button is pressed.
 * @return {void}
 */
app.onPwSignIn = function() {
  // Construct `FormData` object from actual `form`
  var form = new FormData(this.$.form);
  // Don't forget to include the CSRF Token.
  form.append('csrf_token', document.querySelector('#csrf_token').value);

  // Sign-In with our own server
  app.pwSignIn(form)
  .then(function(profile) {
    // `profile` may involve user name returned by the server
    form.append('name', profile.name);
    // Store credential information before posting
    app._storeCredential(PASSWORD_LOGIN, form);
  });
};

/**
 * Let user sign-in using id/password
 * @param  {FormData|CredentialObject} cred FormData or CredentialObject
 * @return {Promise} Returns result of `_authenticateWithServer()`
 */
app.pwSignIn = function(cred) {
  return app._authenticateWithServer(PASSWORD_LOGIN, cred);
};

/**
 * When google sign-in button is pressed.
 * @return {void}
 */
app.onGSignIn = function() {
  app.gSignIn()
  .then(function(profile) {
    // Store credential information after successful authentication
    app._storeCredential(GOOGLE_SIGNIN, profile);
  });
};

/**
 * Let user sign-in using Google Sign-in
 * @param  {String} id Preferred Gmail address for user to sign-in
 * @return {Promise} Returns result of authFlow
 */
app.gSignIn = function(id) {
  var auth2 = gapi.auth2.getAuthInstance();
  return auth2.signIn({
    // Set `login_hint` to specify an intended user account,
    // otherwise user selection dialog will popup.
    login_hint: id || ''
  }).then(function(googleUser) {
    // Now user is successfully authenticated with Google.
    // Send ID Token to the server to authenticate with our server.
    form = new FormData();
    form.append('id_token', googleUser.getAuthResponse().id_token);
    // Don't forget to include the CSRF Token.
    form.append('csrf_token', document.querySelector('#csrf_token').value);
    return app._authenticateWithServer(GOOGLE_SIGNIN, form);
  });
};

/**
 * When facebook login button is pressed.
 * @return {void}
 */
app.onFbSignIn = function() {
  app.fbSignIn().then(function(profile) {
    // Store credential information after successful authentication
    app._storeCredential(FACEBOOK_LOGIN, profile);
  });
};

/**
 * Let user sign-in using Facebook Login
 * @return {Promise} Returns result of authFlow
 */
app.fbSignIn = function() {
  // Return Promise after Facebook Login dance.
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
    // On successful authentication with Facebook
    if (res.status == 'connected') {
      var form = new FormData();
      // For Facebook, we use the Access Token to authenticate.
      form.append('access_token', res.authResponse.accessToken);
      // Don't forget to include the CSRF Token.
      form.append('csrf_token', document.querySelector('#csrf_token').value);
      return app._authenticateWithServer(FACEBOOK_LOGIN, form);
    } else {
      // When authentication was rejected by Facebook
      return Promise.reject();
    }
  });
};

/**
 * Invoked when 'Register' button is pressed, performs registration flow
 * and let user sign-in.
 * @return {void}
 */
app.onRegister = function() {
  var form = new FormData(document.querySelector('#regForm'));
  // Don't forget to include the CSRF Token.
  form.append('csrf_token', document.querySelector('#csrf_token').value);

  fetch('/register', {
    method:       'POST',
    body:         form,
    // `credentials:'include'` is required to include cookie on `fetch`
    credentials:  'include'
  }).then(function(res) {
    if (res.status == 200) {
      return res.json();
    } else {
      throw 'Response code: ' + res.status;
    }
  }).then(function(profile) {
    if (profile && profile.email) {
      app.fire('show-toast', {
        text: 'Thanks for signing up!'
      });
      // Polymer will taking care of filling up user info on HTML template
      app.userProfile = {
        id:       profile.id,
        name:     profile.name,
        email:    profile.email,
        imageUrl: profile.imageUrl || DEFAULT_IMG
      };
      app.$.dialog.close();

      // Store user information as this is registration using id/password
      app._storeCredential(PASSWORD_LOGIN, form);
    } else {
      throw 'Registration failed';
    }
  }).catch(function(e) {
    app.fire('show-toast', {
      text: e
    });
  });
};

/**
 * Invoked when 'Unregister' button is pressed, unregisters user.
 * @return {[type]} [description]
 */
app.onUnregister = function() {
  var form = new FormData();
  // POST `id` to `/unregister` to unregister the user
  form.append('id', app.userProfile.id);
  // Don't forget to include the CSRF Token.
  form.append('csrf_token', document.querySelector('#csrf_token').value);

  fetch('/unregister', {
    method:       'POST',
    body:         form,
    // `credentials:'include'` is required to include cookie on `fetch`
    credentials:  'include'
  }).then(function(res) {
    if (res.status != 200) {
      throw 'Could not unregister';
    }
    if (app.cmaEnabled) {
      // Turn on the mediation mode so auto sign-in won't happen
      // until next time user intended to do so.
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

//
/**
 * Invoked when 'Sign-out' button is pressed, performs sign-out.
 * @return {void}
 */
app.signOut = function() {
  var form = new FormData();
  // Don't forget to include the CSRF Token.
  form.append('csrf_token', document.querySelector('#csrf_token').value);

  fetch('/signout', {
    method:       'POST',
    body:         form,
    // `credentials:'include'` is required to include cookie on `fetch`
    credentials:  'include'
  }).then(function() {
    if (app.cmaEnabled) {
      // Turn on the mediation mode so auto sign-in won't happen
      // until next time user intended to do so.
      navigator.credentials.requireUserMediation();
    }
    app.userProfile = null;
    app.fire('show-toast', {
      text: "You're signed out."
    });
  });
};

/**
 * User is signed in. Fill user info.
 * @param  {Object} res Profile information object
 * @return {Promise} Resolves when authentication succeeded.
 */
app.signedIn = function(res) {
  return new Promise(function(resolve, reject) {
    if (res && res.name && res.email) {
      app.fire('show-toast', {
        text: "You're signed in."
      });
      app.userProfile = {
        id:       res.id,
        name:     res.name,
        email:    res.email,
        imageUrl: res.imageUrl || DEFAULT_IMG
      };
      app.$.dialog.close();
      resolve(res);
    } else {
      reject('Authentication failed');
    }
  });
};

/**
 * Polymer event handler to show a toast.
 * @param  {Event} e Polymer custom event object
 * @return {void}
 */
app.showToast = function(e) {
  this.$.toast.text = e.detail.text;
  this.$.toast.show();
};

/**
 * Invoked when 'Sign-In' button is pressed, perform auto-sign-in and
 * open dialog if it fails.
 * @return {void}
 */
app.openDialog = function() {
  // Try auto sign-in before opening the dialog
  app._autoSignIn(false)
  .catch(function() {
    // When auto sign-in fail, open the dialog
    // so the user can enter id/password
    // or select federated login manually
    app.$.dialog.open();
  });
};

// Initialise Facebook Login
FB.init({
  // Replace this with your own App ID
  appId:    FB_APPID,
  cookie:   true,
  xfbml:    false,
  version:  'v2.5'
});

// Initialise Google Sign-In
gapi.load('auth2', function() {
  gapi.auth2.init();
  if (app.cmaEnabled) {
    // Try auto sign-in performance after initialization
    app._autoSignIn(true).then(function() {
      console.log('auto sign-in succeeded.');
    }, function() {
      console.log('auto sign-in was not performed.');
    });
  }
});
