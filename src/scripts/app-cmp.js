function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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

const PASSWORD_LOGIN = 'password';
const GOOGLE_SIGNIN = 'https://accounts.google.com';
const FACEBOOK_LOGIN = 'https://www.facebook.com';
const REGISTER = 'register';
const UNREGISTER = 'unregister';
const SIGNOUT = 'singout';
const DEFAULT_IMG = '/images/default_img.png';

/*
  Although this sample app is using Polymer, most of the interactions are
  handled using regular APIs so you don't have to learn about it.
 */
let app = document.querySelector('#app');
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
 * Authentication flow with our own server
 * @param  {String} provider Credential type string.
 * @param  {FormData} form FormData to POST to the server
 * @return {Promise} Resolves when successfully authenticated
 */
app._fetch = (() => {
  var _ref = _asyncToGenerator(function* (provider, c = new FormData()) {
    let url = '';
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
      case REGISTER:
        url = '/register';
        break;
      case UNREGISTER:
        url = '/unregister';
        break;
      case SIGNOUT:
        url = '/signout';
        break;
    }

    let res;
    if (c instanceof PasswordCredential) {
      res = yield fetch(url, {
        method: 'POST',
        headers: {
          // `X-Requested-With` header to avoid CSRF attacks
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: c
      });
    } else {
      res = yield fetch(url, {
        method: 'POST',
        // `credentials:'include'` is required to include cookies on `fetch`
        credentials: 'include',
        headers: {
          // `X-Requested-With` header to avoid CSRF attacks
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: c
      });
    }
    // Convert JSON string to an object
    if (res.status === 200) {
      return res.json();
    } else {
      return Promise.reject();
    }
  });

  return function (_x) {
    return _ref.apply(this, arguments);
  };
})();

/**
 * Let users sign-in without typing credentials
 * @param  {Boolean} silent Determines if account chooser shouldn't be
 * displayed.
 * @return {Promise} Resolves if credential info is available.
 */
app._autoSignIn = (() => {
  var _ref2 = _asyncToGenerator(function* (silent) {
    if (app.cmaEnabled) {
      // Actual Credential Management API call to get credential object
      let cred = yield navigator.credentials.get({
        password: true,
        federated: {
          providers: [GOOGLE_SIGNIN, FACEBOOK_LOGIN]
        },
        mediation: silent ? 'silent' : 'optional'
      });
      // If credential object is available
      if (cred) {
        console.log('auto sign-in performed');

        let promise;
        switch (cred.type) {
          case 'password':
            // If `password` prop doesn't exist, this is Chrome < 60
            if (cred.password === undefined) {
              cred.idName = 'email';
              promise = app._fetch(PASSWORD_LOGIN, cred);

              // Otherwise, this is Chrome => 60
            } else {
              // Change form `id` name to `email`
              let form = new FormData();
              form.append('email', cred.id);
              form.append('password', cred.password);
              promise = app._fetch(PASSWORD_LOGIN, form);
            }
            break;
          case 'federated':
            switch (cred.provider) {
              case GOOGLE_SIGNIN:
                // Return Promise from `gSignIn`
                promise = app.gSignIn(cred.id);
                break;
              case FACEBOOK_LOGIN:
                // Return Promise from `fbSignIn`
                promise = app.fbSignIn();
                break;
            }
            break;
        }
        if (promise) {
          return promise.then(app.signedIn);
        } else {
          return Promise.resolve();
        }
      } else {
        console.log('auto sign-in not performed');

        // Resolve if credential object is not available
        return Promise.resolve();
      }
    } else {
      // Resolve if Credential Management API is not available
      return Promise.resolve();
    }
  });

  return function (_x2) {
    return _ref2.apply(this, arguments);
  };
})();

/**
 * When password sign-in button is pressed.
 * @return {void}
 */
app.onPwSignIn = function (e) {
  e.preventDefault();

  let signinForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!signinForm.validate()) return;

  let form = new FormData(signinForm);

  // Sign-In with our own server
  app._fetch(PASSWORD_LOGIN, form).then(app.signedIn).then(profile => {
    app.$.dialog.close();

    if (app.cmaEnabled) {
      // Construct `FormData` object from actual `form`
      let cred = new PasswordCredential(signinForm);
      cred.name = profile.name;

      // Store credential information before posting
      navigator.credentials.store(cred);
    }
    app.fire('show-toast', {
      text: 'You are signed in'
    });
  }, () => {
    // Polymer event to notice user that 'Authentication failed'.
    app.fire('show-toast', {
      text: 'Authentication failed'
    });
  });
};

/**
 * When google sign-in button is pressed.
 * @return {void}
 */
app.onGSignIn = function () {
  app.gSignIn().then(app.signedIn).then(profile => {
    app.$.dialog.close();

    if (app.cmaEnabled) {
      // Create `Credential` object for federation
      var cred = new FederatedCredential({
        id: profile.email,
        name: profile.name,
        iconURL: profile.imageUrl || DEFAULT_IMG,
        provider: GOOGLE_SIGNIN
      });
      // Store credential information after successful authentication
      navigator.credentials.store(cred);
    }
    app.fire('show-toast', {
      text: 'You are signed in'
    });
  }, () => {
    // Polymer event to notice user that 'Authentication failed'.
    app.fire('show-toast', {
      text: 'Authentication failed'
    });
  });
};

/**
 * Let user sign-in using Google Sign-in
 * @param  {String} id Preferred Gmail address for user to sign-in
 * @return {Promise} Returns result of authFlow
 */
app.gSignIn = function (id) {
  // Return Promise after Facebook Login dance.
  return (() => {
    let auth2 = gapi.auth2.getAuthInstance();
    if (auth2.isSignedIn.get()) {
      // Check if currently signed in user is the same as intended.
      let googleUser = auth2.currentUser.get();
      if (googleUser.getBasicProfile().getEmail() === id) {
        return Promise.resolve(googleUser);
      }
    }
    // If the user is not signed in with expected account, let sign in.
    return auth2.signIn({
      // Set `login_hint` to specify an intended user account,
      // otherwise user selection dialog will popup.
      login_hint: id || ''
    });
  })().then(googleUser => {
    // Now user is successfully authenticated with Google.
    // Send ID Token to the server to authenticate with our server.
    let form = new FormData();
    form.append('id_token', googleUser.getAuthResponse().id_token);
    return app._fetch(GOOGLE_SIGNIN, form);
  });
};

/**
 * When facebook login button is pressed.
 * @return {void}
 */
app.onFbSignIn = function () {
  app.fbSignIn().then(app.signedIn).then(profile => {
    app.$.dialog.close();

    if (app.cmaEnabled) {
      // Create `Credential` object for federation
      var cred = new FederatedCredential({
        id: profile.email,
        name: profile.name,
        iconURL: profile.imageUrl || DEFAULT_IMG,
        provider: FACEBOOK_LOGIN
      });
      // Store credential information after successful authentication
      navigator.credentials.store(cred);
    }
    app.fire('show-toast', {
      text: 'You are signed in'
    });
  }, () => {
    // Polymer event to notice user that 'Authentication failed'.
    app.fire('show-toast', {
      text: 'Authentication failed'
    });
  });
};

/**
 * Let user sign-in using Facebook Login
 * @return {Promise} Returns result of authFlow
 */
app.fbSignIn = function () {
  // Return Promise after Facebook Login dance.
  return (() => {
    return new Promise(function (resolve) {
      FB.getLoginStatus(function (res) {
        if (res.status == 'connected') {
          resolve(res);
        } else {
          FB.login(resolve, { scope: 'email' });
        }
      });
    });
  })().then(res => {
    // On successful authentication with Facebook
    if (res.status == 'connected') {
      // For Facebook, we use the Access Token to authenticate.
      let form = new FormData();
      form.append('access_token', res.authResponse.accessToken);
      return app._fetch(FACEBOOK_LOGIN, form);
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
app.onRegister = function (e) {
  e.preventDefault();

  let regForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!regForm.validate()) return;

  app._fetch(REGISTER, new FormData(regForm)).then(app.signedIn).then(profile => {
    app.fire('show-toast', {
      text: 'Thanks for signing up!'
    });

    if (app.cmaEnabled) {
      // Create password credential
      let cred = new PasswordCredential(regForm);
      cred.name = profile.name;
      cred.iconURL = profile.imageUrl;

      // Store user information as this is registration using id/password
      navigator.credentials.store(cred);
    }
  }, () => {
    app.fire('show-toast', {
      text: 'Registration failed'
    });
  });
};

/**
 * Invoked when 'Unregister' button is pressed, unregisters user.
 * @return {[type]} [description]
 */
app.onUnregister = function () {
  // POST `id` to `/unregister` to unregister the user
  let form = new FormData();
  form.append('id', app.userProfile.id);

  app._fetch(UNREGISTER, form).then(() => {
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
  }, e => {
    console.error(e);
    app.fire('show-toast', {
      text: 'Failed to unregister'
    });
  });
};

/**
 * Invoked when 'Sign-out' button is pressed, performs sign-out.
 * @return {void}
 */
app.signOut = function () {
  app._fetch(SIGNOUT).then(() => {
    if (app.cmaEnabled) {
      // Turn on the mediation mode so auto sign-in won't happen
      // until next time user intended to do so.
      navigator.credentials.preventSilentAccess();
    }
    app.userProfile = null;
    app.fire('show-toast', {
      text: "You're signed out."
    });
  }, () => {
    app.fire('show-toast', {
      text: 'Failed to sign out'
    });
  });
};

/**
 * User is signed in. Fill user info.
 * @param  {Object} profile Profile information object
 * @return {Promise} Resolves when authentication succeeded.
 */
app.signedIn = function (profile) {
  if (profile && profile.name && profile.email) {
    app.userProfile = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      imageUrl: profile.imageUrl || DEFAULT_IMG
    };
    return Promise.resolve(profile);
  } else {
    return Promise.reject();
  }
};

/**
 * Polymer event handler to show a toast.
 * @param  {Event} e Polymer custom event object
 * @return {void}
 */
app.showToast = function (e) {
  this.$.toast.text = e.detail.text;
  this.$.toast.show();
};

/**
 * Invoked when 'Sign-In' button is pressed, perform auto-sign-in and
 * open dialog if it fails.
 * @return {void}
 */
app.openDialog = function () {
  // Try auto sign-in before opening the dialog
  app._autoSignIn(false).then(profile => {
    // When auto sign-in didn't resolve with a profile
    // it's failed to get credential information.
    // Open the form so the user can enter id/password
    // or select federated login manually
    if (!profile) {
      app.$.dialog.open();
    }
  }, () => {
    app.$.dialog.open();
    // When rejected, authentication was performed but failed.
    app.fire('show-toast', {
      text: 'Authentication failed'
    });
  });
};

// Initialise Facebook Login
FB.init({
  // Replace this with your own App ID
  appId: FB_APPID,
  cookie: true,
  xfbml: false,
  version: 'v2.5'
});

// Initialise Google Sign-In
gapi.load('auth2', function () {
  gapi.auth2.init().then(() => {
    // Try auto sign-in performance after initialization
    app._autoSignIn(true);
  });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyJdLCJuYW1lcyI6WyJQQVNTV09SRF9MT0dJTiIsIkdPT0dMRV9TSUdOSU4iLCJGQUNFQk9PS19MT0dJTiIsIlJFR0lTVEVSIiwiVU5SRUdJU1RFUiIsIlNJR05PVVQiLCJERUZBVUxUX0lNRyIsImFwcCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsImNtYUVuYWJsZWQiLCJuYXZpZ2F0b3IiLCJjcmVkZW50aWFscyIsInNlbGVjdGVkIiwidXNlclByb2ZpbGUiLCJsaXN0ZW5lcnMiLCJfZmV0Y2giLCJwcm92aWRlciIsImMiLCJGb3JtRGF0YSIsInVybCIsInJlcyIsIlBhc3N3b3JkQ3JlZGVudGlhbCIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsImJvZHkiLCJzdGF0dXMiLCJqc29uIiwiUHJvbWlzZSIsInJlamVjdCIsIl9hdXRvU2lnbkluIiwic2lsZW50IiwiY3JlZCIsImdldCIsInBhc3N3b3JkIiwiZmVkZXJhdGVkIiwicHJvdmlkZXJzIiwibWVkaWF0aW9uIiwiY29uc29sZSIsImxvZyIsInByb21pc2UiLCJ0eXBlIiwidW5kZWZpbmVkIiwiaWROYW1lIiwiZm9ybSIsImFwcGVuZCIsImlkIiwiZ1NpZ25JbiIsImZiU2lnbkluIiwidGhlbiIsInNpZ25lZEluIiwicmVzb2x2ZSIsIm9uUHdTaWduSW4iLCJlIiwicHJldmVudERlZmF1bHQiLCJzaWduaW5Gb3JtIiwidGFyZ2V0IiwidmFsaWRhdGUiLCJwcm9maWxlIiwiJCIsImRpYWxvZyIsImNsb3NlIiwibmFtZSIsInN0b3JlIiwiZmlyZSIsInRleHQiLCJvbkdTaWduSW4iLCJGZWRlcmF0ZWRDcmVkZW50aWFsIiwiZW1haWwiLCJpY29uVVJMIiwiaW1hZ2VVcmwiLCJhdXRoMiIsImdhcGkiLCJnZXRBdXRoSW5zdGFuY2UiLCJpc1NpZ25lZEluIiwiZ29vZ2xlVXNlciIsImN1cnJlbnRVc2VyIiwiZ2V0QmFzaWNQcm9maWxlIiwiZ2V0RW1haWwiLCJzaWduSW4iLCJsb2dpbl9oaW50IiwiZ2V0QXV0aFJlc3BvbnNlIiwiaWRfdG9rZW4iLCJvbkZiU2lnbkluIiwiRkIiLCJnZXRMb2dpblN0YXR1cyIsImxvZ2luIiwic2NvcGUiLCJhdXRoUmVzcG9uc2UiLCJhY2Nlc3NUb2tlbiIsIm9uUmVnaXN0ZXIiLCJyZWdGb3JtIiwib25VbnJlZ2lzdGVyIiwicmVxdWlyZVVzZXJNZWRpYXRpb24iLCJlcnJvciIsInNpZ25PdXQiLCJwcmV2ZW50U2lsZW50QWNjZXNzIiwic2hvd1RvYXN0IiwidG9hc3QiLCJkZXRhaWwiLCJzaG93Iiwib3BlbkRpYWxvZyIsIm9wZW4iLCJpbml0IiwiYXBwSWQiLCJGQl9BUFBJRCIsImNvb2tpZSIsInhmYm1sIiwidmVyc2lvbiIsImxvYWQiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLE1BQU1BLGlCQUFpQixVQUF2QjtBQUNBLE1BQU1DLGdCQUFpQiw2QkFBdkI7QUFDQSxNQUFNQyxpQkFBaUIsMEJBQXZCO0FBQ0EsTUFBTUMsV0FBaUIsVUFBdkI7QUFDQSxNQUFNQyxhQUFpQixZQUF2QjtBQUNBLE1BQU1DLFVBQWlCLFNBQXZCO0FBQ0EsTUFBTUMsY0FBaUIseUJBQXZCOztBQUVBOzs7O0FBSUEsSUFBSUMsTUFBTUMsU0FBU0MsYUFBVCxDQUF1QixNQUF2QixDQUFWO0FBQ0FGLElBQUlHLFVBQUosR0FBaUIsQ0FBQyxDQUFDQyxVQUFVQyxXQUE3QjtBQUNBO0FBQ0FMLElBQUlNLFFBQUosR0FBZSxDQUFmO0FBQ0E7QUFDQU4sSUFBSU8sV0FBSixHQUFrQixJQUFsQjtBQUNBO0FBQ0FQLElBQUlRLFNBQUosR0FBZ0I7QUFDZCxnQkFBYztBQURBLENBQWhCOztBQUlBOzs7Ozs7QUFNQVIsSUFBSVMsTUFBSjtBQUFBLCtCQUFhLFdBQWVDLFFBQWYsRUFBeUJDLElBQUksSUFBSUMsUUFBSixFQUE3QixFQUE2QztBQUN4RCxRQUFJQyxNQUFNLEVBQVY7QUFDQSxZQUFRSCxRQUFSO0FBQ0UsV0FBS2YsY0FBTDtBQUNFa0Is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QUNacEQsVUFBSXFELENBQUosQ0FBTUMsTUFBTixDQUFhMEMsSUFBYjtBQUNEO0FBQ0YsR0FURCxFQVNHLE1BQU07QUFDUGhHLFFBQUlxRCxDQUFKLENBQU1DLE1BQU4sQ0FBYTBDLElBQWI7QUFDQTtBQUNBaEcsUUFBSTBELElBQUosQ0FBUyxZQUFULEVBQXVCO0FBQ3JCQyxZQUFNO0FBRGUsS0FBdkI7QUFHRCxHQWZEO0FBZ0JELENBbEJEOztBQW9CQTtBQUNBbUIsR0FBR21CLElBQUgsQ0FBUTtBQUNOO0FBQ0FDLFNBQVVDLFFBRko7QUFHTkMsVUFBVSxJQUhKO0FBSU5DLFNBQVUsS0FKSjtBQUtOQyxXQUFVO0FBTEosQ0FBUjs7QUFRQTtBQUNBcEMsS0FBS3FDLElBQUwsQ0FBVSxPQUFWLEVBQW1CLFlBQVc7QUFDNUJyQyxPQUFLRCxLQUFMLENBQVdnQyxJQUFYLEdBQ0N0RCxJQURELENBQ00sTUFBTTtBQUNWO0FBQ0EzQyxRQUFJd0IsV0FBSixDQUFnQixJQUFoQjtBQUNELEdBSkQ7QUFLRCxDQU5EIiwiZmlsZSI6ImFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICpcbiAqIENvcHlyaWdodCAyMDE2IEdvb2dsZSBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmNvbnN0IFBBU1NXT1JEX0xPR0lOID0gJ3Bhc3N3b3JkJztcbmNvbnN0IEdPT0dMRV9TSUdOSU4gID0gJ2h0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSc7XG5jb25zdCBGQUNFQk9PS19MT0dJTiA9ICdodHRwczovL3d3dy5mYWNlYm9vay5jb20nO1xuY29uc3QgUkVHSVNURVIgICAgICAgPSAncmVnaXN0ZXInO1xuY29uc3QgVU5SRUdJU1RFUiAgICAgPSAndW5yZWdpc3Rlcic7XG5jb25zdCBTSUdOT1VUICAgICAgICA9ICdzaW5nb3V0JztcbmNvbnN0IERFRkFVTFRfSU1HICAgID0gJy9pbWFnZXMvZGVmYXVsdF9pbWcucG5nJztcblxuLypcbiAgQWx0aG91Z2ggdGhpcyBzYW1wbGUgYXBwIGlzIHVzaW5nIFBvbHltZXIsIG1vc3Qgb2YgdGhlIGludGVyYWN0aW9ucyBhcmVcbiAgaGFuZGxlZCB1c2luZyByZWd1bGFyIEFQSXMgc28geW91IGRvbid0IGhhdmUgdG8gbGVhcm4gYWJvdXQgaXQuXG4gKi9cbmxldCBhcHAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXBwJyk7XG5hcHAuY21hRW5hYmxlZCA9ICEhbmF2aWdhdG9yLmNyZWRlbnRpYWxzO1xuLy8gYHNlbGVjdGVkYCBpcyB1c2VkIHRvIHNob3cgYSBwb3J0aW9uIG9mIG91ciBwYWdlXG5hcHAuc2VsZWN0ZWQgPSAwO1xuLy8gVXNlciBwcm9maWxlIGF1dG9tYXRpY2FsbHkgc2hvdyB1cCB3aGVuIGFuIG9iamVjdCBpcyBzZXQuXG5hcHAudXNlclByb2ZpbGUgPSBudWxsO1xuLy8gU2V0IGFuIGV2ZW50IGxpc3RlbmVyIHRvIHNob3cgYSB0b2FzdC4gKFBvbHltZXIpXG5hcHAubGlzdGVuZXJzID0ge1xuICAnc2hvdy10b2FzdCc6ICdzaG93VG9hc3QnXG59O1xuXG4vKipcbiAqIEF1dGhlbnRpY2F0aW9uIGZsb3cgd2l0aCBvdXIgb3duIHNlcnZlclxuICogQHBhcmFtICB7U3RyaW5nfSBwcm92aWRlciBDcmVkZW50aWFsIHR5cGUgc3RyaW5nLlxuICogQHBhcmFtICB7Rm9ybURhdGF9IGZvcm0gRm9ybURhdGEgdG8gUE9TVCB0byB0aGUgc2VydmVyXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyB3aGVuIHN1Y2Nlc3NmdWxseSBhdXRoZW50aWNhdGVkXG4gKi9cbmFwcC5fZmV0Y2ggPSBhc3luYyBmdW5jdGlvbihwcm92aWRlciwgYyA9IG5ldyBGb3JtRGF0YSgpKSB7XG4gIGxldCB1cmwgPSAnJztcbiAgc3dpdGNoIChwcm92aWRlcikge1xuICAgIGNhc2UgRkFDRUJPT0tfTE9HSU46XG4gICAgICB1cmwgPSAnL2F1dGgvZmFjZWJvb2snO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBHT09HTEVfU0lHTklOOlxuICAgICAgdXJsID0gJy9hdXRoL2dvb2dsZSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFBBU1NXT1JEX0xPR0lOOlxuICAgICAgdXJsID0gJy9hdXRoL3Bhc3N3b3JkJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgUkVHSVNURVI6XG4gICAgICB1cmwgPSAnL3JlZ2lzdGVyJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVU5SRUdJU1RFUjpcbiAgICAgIHVybCA9ICcvdW5yZWdpc3Rlcic7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFNJR05PVVQ6XG4gICAgICB1cmwgPSAnL3NpZ25vdXQnO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBsZXQgcmVzO1xuICBpZiAoYyBpbnN0YW5jZW9mIFBhc3N3b3JkQ3JlZGVudGlhbCkge1xuICAgIHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC8vIGBYLVJlcXVlc3RlZC1XaXRoYCBoZWFkZXIgdG8gYXZvaWQgQ1NSRiBhdHRhY2tzXG4gICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJzogJ1hNTEh0dHBSZXF1ZXN0J1xuICAgICAgfSxcbiAgICAgIGNyZWRlbnRpYWxzOiBjXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgLy8gYGNyZWRlbnRpYWxzOidpbmNsdWRlJ2AgaXMgcmVxdWlyZWQgdG8gaW5jbHVkZSBjb29raWVzIG9uIGBmZXRjaGBcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC8vIGBYLVJlcXVlc3RlZC1XaXRoYCBoZWFkZXIgdG8gYXZvaWQgQ1NSRiBhdHRhY2tzXG4gICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJzogJ1hNTEh0dHBSZXF1ZXN0J1xuICAgICAgfSxcbiAgICAgIGJvZHk6IGNcbiAgICB9KTtcbiAgfVxuICAvLyBDb252ZXJ0IEpTT04gc3RyaW5nIHRvIGFuIG9iamVjdFxuICBpZiAocmVzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gIH1cbn07XG5cbi8qKlxuICogTGV0IHVzZXJzIHNpZ24taW4gd2l0aG91dCB0eXBpbmcgY3JlZGVudGlhbHNcbiAqIEBwYXJhbSAge0Jvb2xlYW59IHNpbGVudCBEZXRlcm1pbmVzIGlmIGFjY291bnQgY2hvb3NlciBzaG91bGRuJ3QgYmVcbiAqIGRpc3BsYXllZC5cbiAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIGlmIGNyZWRlbnRpYWwgaW5mbyBpcyBhdmFpbGFibGUuXG4gKi9cbmFwcC5fYXV0b1NpZ25JbiA9IGFzeW5jIGZ1bmN0aW9uKHNpbGVudCkge1xuICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAvLyBBY3R1YWwgQ3JlZGVudGlhbCBNYW5hZ2VtZW50IEFQSSBjYWxsIHRvIGdldCBjcmVkZW50aWFsIG9iamVjdFxuICAgIGxldCBjcmVkID0gYXdhaXQgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLmdldCh7XG4gICAgICBwYXNzd29yZDogdHJ1ZSxcbiAgICAgIGZlZGVyYXRlZDoge1xuICAgICAgICBwcm92aWRlcnM6IFtHT09HTEVfU0lHTklOLCBGQUNFQk9PS19MT0dJTl1cbiAgICAgIH0sXG4gICAgICBtZWRpYXRpb246IHNpbGVudCA/ICdzaWxlbnQnIDogJ29wdGlvbmFsJ1xuICAgIH0pO1xuICAgIC8vIElmIGNyZWRlbnRpYWwgb2JqZWN0IGlzIGF2YWlsYWJsZVxuICAgIGlmIChjcmVkKSB7XG4gICAgICBjb25zb2xlLmxvZygnYXV0byBzaWduLWluIHBlcmZvcm1lZCcpO1xuXG4gICAgICBsZXQgcHJvbWlzZTtcbiAgICAgIHN3aXRjaCAoY3JlZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3Bhc3N3b3JkJzpcbiAgICAgICAgICAvLyBJZiBgcGFzc3dvcmRgIHByb3AgZG9lc24ndCBleGlzdCwgdGhpcyBpcyBDaHJvbWUgPCA2MFxuICAgICAgICAgIGlmIChjcmVkLnBhc3N3b3JkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNyZWQuaWROYW1lID0gJ2VtYWlsJztcbiAgICAgICAgICAgIHByb21pc2UgPSBhcHAuX2ZldGNoKFBBU1NXT1JEX0xPR0lOLCBjcmVkKTtcblxuICAgICAgICAgIC8vIE90aGVyd2lzZSwgdGhpcyBpcyBDaHJvbWUgPT4gNjBcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ2hhbmdlIGZvcm0gYGlkYCBuYW1lIHRvIGBlbWFpbGBcbiAgICAgICAgICAgIGxldCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgICAgICBmb3JtLmFwcGVuZCgnZW1haWwnLCBjcmVkLmlkKTtcbiAgICAgICAgICAgIGZvcm0uYXBwZW5kKCdwYXNzd29yZCcsIGNyZWQucGFzc3dvcmQpO1xuICAgICAgICAgICAgcHJvbWlzZSA9IGFwcC5fZmV0Y2goUEFTU1dPUkRfTE9HSU4sIGZvcm0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZmVkZXJhdGVkJzpcbiAgICAgICAgICBzd2l0Y2ggKGNyZWQucHJvdmlkZXIpIHtcbiAgICAgICAgICAgIGNhc2UgR09PR0xFX1NJR05JTjpcbiAgICAgICAgICAgICAgLy8gUmV0dXJuIFByb21pc2UgZnJvbSBgZ1NpZ25JbmBcbiAgICAgICAgICAgICAgcHJvbWlzZSA9IGFwcC5nU2lnbkluKGNyZWQuaWQpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgRkFDRUJPT0tfTE9HSU46XG4gICAgICAgICAgICAgIC8vIFJldHVybiBQcm9taXNlIGZyb20gYGZiU2lnbkluYFxuICAgICAgICAgICAgICBwcm9taXNlID0gYXBwLmZiU2lnbkluKCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChwcm9taXNlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oYXBwLnNpZ25lZEluKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ2F1dG8gc2lnbi1pbiBub3QgcGVyZm9ybWVkJyk7XG5cbiAgICAgIC8vIFJlc29sdmUgaWYgY3JlZGVudGlhbCBvYmplY3QgaXMgbm90IGF2YWlsYWJsZVxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBSZXNvbHZlIGlmIENyZWRlbnRpYWwgTWFuYWdlbWVudCBBUEkgaXMgbm90IGF2YWlsYWJsZVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBXaGVuIHBhc3N3b3JkIHNpZ24taW4gYnV0dG9uIGlzIHByZXNzZWQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAub25Qd1NpZ25JbiA9IGZ1bmN0aW9uKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gIGxldCBzaWduaW5Gb3JtID0gZS50YXJnZXQ7XG5cbiAgLy8gUG9seW1lciBgaXJvbi1mb3JtYCBmZWF0dXJlIHRvIHZhbGlkYXRlIHRoZSBmb3JtXG4gIGlmICghc2lnbmluRm9ybS52YWxpZGF0ZSgpKSByZXR1cm47XG5cbiAgbGV0IGZvcm0gPSBuZXcgRm9ybURhdGEoc2lnbmluRm9ybSk7XG5cbiAgLy8gU2lnbi1JbiB3aXRoIG91ciBvd24gc2VydmVyXG4gIGFwcC5fZmV0Y2goUEFTU1dPUkRfTE9HSU4sIGZvcm0pXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENvbnN0cnVjdCBgRm9ybURhdGFgIG9iamVjdCBmcm9tIGFjdHVhbCBgZm9ybWBcbiAgICAgIGxldCBjcmVkID0gbmV3IFBhc3N3b3JkQ3JlZGVudGlhbChzaWduaW5Gb3JtKTtcbiAgICAgIGNyZWQubmFtZSA9IHByb2ZpbGUubmFtZTtcblxuICAgICAgLy8gU3RvcmUgY3JlZGVudGlhbCBpbmZvcm1hdGlvbiBiZWZvcmUgcG9zdGluZ1xuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnN0b3JlKGNyZWQpO1xuICAgIH1cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdZb3UgYXJlIHNpZ25lZCBpbidcbiAgICB9KTtcbiAgfSwgKCkgPT4ge1xuICAgIC8vIFBvbHltZXIgZXZlbnQgdG8gbm90aWNlIHVzZXIgdGhhdCAnQXV0aGVudGljYXRpb24gZmFpbGVkJy5cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBXaGVuIGdvb2dsZSBzaWduLWluIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuYXBwLm9uR1NpZ25JbiA9IGZ1bmN0aW9uKCkge1xuICBhcHAuZ1NpZ25JbigpXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENyZWF0ZSBgQ3JlZGVudGlhbGAgb2JqZWN0IGZvciBmZWRlcmF0aW9uXG4gICAgICB2YXIgY3JlZCA9IG5ldyBGZWRlcmF0ZWRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICAgIGljb25VUkw6ICBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HLFxuICAgICAgICBwcm92aWRlcjogR09PR0xFX1NJR05JTlxuICAgICAgfSk7XG4gICAgICAvLyBTdG9yZSBjcmVkZW50aWFsIGluZm9ybWF0aW9uIGFmdGVyIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb25cbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnWW91IGFyZSBzaWduZWQgaW4nXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICAvLyBQb2x5bWVyIGV2ZW50IHRvIG5vdGljZSB1c2VyIHRoYXQgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcuXG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnQXV0aGVudGljYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogTGV0IHVzZXIgc2lnbi1pbiB1c2luZyBHb29nbGUgU2lnbi1pblxuICogQHBhcmFtICB7U3RyaW5nfSBpZCBQcmVmZXJyZWQgR21haWwgYWRkcmVzcyBmb3IgdXNlciB0byBzaWduLWluXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXR1cm5zIHJlc3VsdCBvZiBhdXRoRmxvd1xuICovXG5hcHAuZ1NpZ25JbiA9IGZ1bmN0aW9uKGlkKSB7XG4gIC8vIFJldHVybiBQcm9taXNlIGFmdGVyIEZhY2Vib29rIExvZ2luIGRhbmNlLlxuICByZXR1cm4gKCgpID0+IHtcbiAgICBsZXQgYXV0aDIgPSBnYXBpLmF1dGgyLmdldEF1dGhJbnN0YW5jZSgpO1xuICAgIGlmIChhdXRoMi5pc1NpZ25lZEluLmdldCgpKSB7XG4gICAgICAvLyBDaGVjayBpZiBjdXJyZW50bHkgc2lnbmVkIGluIHVzZXIgaXMgdGhlIHNhbWUgYXMgaW50ZW5kZWQuXG4gICAgICBsZXQgZ29vZ2xlVXNlciA9IGF1dGgyLmN1cnJlbnRVc2VyLmdldCgpO1xuICAgICAgaWYgKGdvb2dsZVVzZXIuZ2V0QmFzaWNQcm9maWxlKCkuZ2V0RW1haWwoKSA9PT0gaWQpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShnb29nbGVVc2VyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgdGhlIHVzZXIgaXMgbm90IHNpZ25lZCBpbiB3aXRoIGV4cGVjdGVkIGFjY291bnQsIGxldCBzaWduIGluLlxuICAgIHJldHVybiBhdXRoMi5zaWduSW4oe1xuICAgICAgLy8gU2V0IGBsb2dpbl9oaW50YCB0byBzcGVjaWZ5IGFuIGludGVuZGVkIHVzZXIgYWNjb3VudCxcbiAgICAgIC8vIG90aGVyd2lzZSB1c2VyIHNlbGVjdGlvbiBkaWFsb2cgd2lsbCBwb3B1cC5cbiAgICAgIGxvZ2luX2hpbnQ6IGlkIHx8ICcnXG4gICAgfSk7XG4gIH0pKCkudGhlbihnb29nbGVVc2VyID0+IHtcbiAgICAvLyBOb3cgdXNlciBpcyBzdWNjZXNzZnVsbHkgYXV0aGVudGljYXRlZCB3aXRoIEdvb2dsZS5cbiAgICAvLyBTZW5kIElEIFRva2VuIHRvIHRoZSBzZXJ2ZXIgdG8gYXV0aGVudGljYXRlIHdpdGggb3VyIHNlcnZlci5cbiAgICBsZXQgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm0uYXBwZW5kKCdpZF90b2tlbicsIGdvb2dsZVVzZXIuZ2V0QXV0aFJlc3BvbnNlKCkuaWRfdG9rZW4pO1xuICAgIHJldHVybiBhcHAuX2ZldGNoKEdPT0dMRV9TSUdOSU4sIGZvcm0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogV2hlbiBmYWNlYm9vayBsb2dpbiBidXR0b24gaXMgcHJlc3NlZC5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vbkZiU2lnbkluID0gZnVuY3Rpb24oKSB7XG4gIGFwcC5mYlNpZ25JbigpXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENyZWF0ZSBgQ3JlZGVudGlhbGAgb2JqZWN0IGZvciBmZWRlcmF0aW9uXG4gICAgICB2YXIgY3JlZCA9IG5ldyBGZWRlcmF0ZWRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICAgIGljb25VUkw6ICBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HLFxuICAgICAgICBwcm92aWRlcjogRkFDRUJPT0tfTE9HSU5cbiAgICAgIH0pO1xuICAgICAgLy8gU3RvcmUgY3JlZGVudGlhbCBpbmZvcm1hdGlvbiBhZnRlciBzdWNjZXNzZnVsIGF1dGhlbnRpY2F0aW9uXG4gICAgICBuYXZpZ2F0b3IuY3JlZGVudGlhbHMuc3RvcmUoY3JlZCk7XG4gICAgfVxuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ1lvdSBhcmUgc2lnbmVkIGluJ1xuICAgIH0pO1xuICB9LCAoKSA9PiB7XG4gICAgLy8gUG9seW1lciBldmVudCB0byBub3RpY2UgdXNlciB0aGF0ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnLlxuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCdcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIExldCB1c2VyIHNpZ24taW4gdXNpbmcgRmFjZWJvb2sgTG9naW5cbiAqIEByZXR1cm4ge1Byb21pc2V9IFJldHVybnMgcmVzdWx0IG9mIGF1dGhGbG93XG4gKi9cbmFwcC5mYlNpZ25JbiA9IGZ1bmN0aW9uKCkge1xuICAvLyBSZXR1cm4gUHJvbWlzZSBhZnRlciBGYWNlYm9vayBMb2dpbiBkYW5jZS5cbiAgcmV0dXJuICgoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgIEZCLmdldExvZ2luU3RhdHVzKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICBpZiAocmVzLnN0YXR1cyA9PSAnY29ubmVjdGVkJykge1xuICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBGQi5sb2dpbihyZXNvbHZlLCB7c2NvcGU6ICdlbWFpbCd9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKCkudGhlbihyZXMgPT4ge1xuICAgIC8vIE9uIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb24gd2l0aCBGYWNlYm9va1xuICAgIGlmIChyZXMuc3RhdHVzID09ICdjb25uZWN0ZWQnKSB7XG4gICAgICAvLyBGb3IgRmFjZWJvb2ssIHdlIHVzZSB0aGUgQWNjZXNzIFRva2VuIHRvIGF1dGhlbnRpY2F0ZS5cbiAgICAgIGxldCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICBmb3JtLmFwcGVuZCgnYWNjZXNzX3Rva2VuJywgcmVzLmF1dGhSZXNwb25zZS5hY2Nlc3NUb2tlbik7XG4gICAgICByZXR1cm4gYXBwLl9mZXRjaChGQUNFQk9PS19MT0dJTiwgZm9ybSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdoZW4gYXV0aGVudGljYXRpb24gd2FzIHJlamVjdGVkIGJ5IEZhY2Vib29rXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1JlZ2lzdGVyJyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybXMgcmVnaXN0cmF0aW9uIGZsb3dcbiAqIGFuZCBsZXQgdXNlciBzaWduLWluLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuYXBwLm9uUmVnaXN0ZXIgPSBmdW5jdGlvbihlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKTtcblxuICBsZXQgcmVnRm9ybSA9IGUudGFyZ2V0O1xuXG4gIC8vIFBvbHltZXIgYGlyb24tZm9ybWAgZmVhdHVyZSB0byB2YWxpZGF0ZSB0aGUgZm9ybVxuICBpZiAoIXJlZ0Zvcm0udmFsaWRhdGUoKSkgcmV0dXJuO1xuXG4gIGFwcC5fZmV0Y2goUkVHSVNURVIsIG5ldyBGb3JtRGF0YShyZWdGb3JtKSlcbiAgLnRoZW4oYXBwLnNpZ25lZEluKVxuICAudGhlbihwcm9maWxlID0+IHtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdUaGFua3MgZm9yIHNpZ25pbmcgdXAhJ1xuICAgIH0pO1xuXG4gICAgaWYgKGFwcC5jbWFFbmFibGVkKSB7XG4gICAgICAvLyBDcmVhdGUgcGFzc3dvcmQgY3JlZGVudGlhbFxuICAgICAgbGV0IGNyZWQgPSBuZXcgUGFzc3dvcmRDcmVkZW50aWFsKHJlZ0Zvcm0pO1xuICAgICAgY3JlZC5uYW1lID0gcHJvZmlsZS5uYW1lO1xuICAgICAgY3JlZC5pY29uVVJMID0gcHJvZmlsZS5pbWFnZVVybDtcblxuICAgICAgLy8gU3RvcmUgdXNlciBpbmZvcm1hdGlvbiBhcyB0aGlzIGlzIHJlZ2lzdHJhdGlvbiB1c2luZyBpZC9wYXNzd29yZFxuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnN0b3JlKGNyZWQpO1xuICAgIH1cbiAgfSwgKCkgPT4ge1xuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ1JlZ2lzdHJhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1VucmVnaXN0ZXInIGJ1dHRvbiBpcyBwcmVzc2VkLCB1bnJlZ2lzdGVycyB1c2VyLlxuICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG4gKi9cbmFwcC5vblVucmVnaXN0ZXIgPSBmdW5jdGlvbigpIHtcbiAgLy8gUE9TVCBgaWRgIHRvIGAvdW5yZWdpc3RlcmAgdG8gdW5yZWdpc3RlciB0aGUgdXNlclxuICBsZXQgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICBmb3JtLmFwcGVuZCgnaWQnLCBhcHAudXNlclByb2ZpbGUuaWQpO1xuXG4gIGFwcC5fZmV0Y2goVU5SRUdJU1RFUiwgZm9ybSlcbiAgLnRoZW4oKCkgPT4ge1xuICAgIGlmIChhcHAuY21hRW5hYmxlZCkge1xuICAgICAgLy8gVHVybiBvbiB0aGUgbWVkaWF0aW9uIG1vZGUgc28gYXV0byBzaWduLWluIHdvbid0IGhhcHBlblxuICAgICAgLy8gdW50aWwgbmV4dCB0aW1lIHVzZXIgaW50ZW5kZWQgdG8gZG8gc28uXG4gICAgICBuYXZpZ2F0b3IuY3JlZGVudGlhbHMucmVxdWlyZVVzZXJNZWRpYXRpb24oKTtcbiAgICB9XG4gICAgYXBwLnVzZXJQcm9maWxlID0gbnVsbDtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6IFwiWW91J3JlIHVucmVnaXN0ZXJlZC5cIlxuICAgIH0pO1xuICAgIGFwcC5zZWxlY3RlZCA9IDA7XG4gIH0sIGUgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnRmFpbGVkIHRvIHVucmVnaXN0ZXInXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1NpZ24tb3V0JyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybXMgc2lnbi1vdXQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAuc2lnbk91dCA9IGZ1bmN0aW9uKCkge1xuICBhcHAuX2ZldGNoKFNJR05PVVQpXG4gIC50aGVuKCgpID0+IHtcbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIFR1cm4gb24gdGhlIG1lZGlhdGlvbiBtb2RlIHNvIGF1dG8gc2lnbi1pbiB3b24ndCBoYXBwZW5cbiAgICAgIC8vIHVudGlsIG5leHQgdGltZSB1c2VyIGludGVuZGVkIHRvIGRvIHNvLlxuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnByZXZlbnRTaWxlbnRBY2Nlc3MoKTtcbiAgICB9XG4gICAgYXBwLnVzZXJQcm9maWxlID0gbnVsbDtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6IFwiWW91J3JlIHNpZ25lZCBvdXQuXCJcbiAgICB9KTtcbiAgfSwgKCkgPT4ge1xuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ0ZhaWxlZCB0byBzaWduIG91dCdcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIFVzZXIgaXMgc2lnbmVkIGluLiBGaWxsIHVzZXIgaW5mby5cbiAqIEBwYXJhbSAge09iamVjdH0gcHJvZmlsZSBQcm9maWxlIGluZm9ybWF0aW9uIG9iamVjdFxuICogQHJldHVybiB7UHJvbWlzZX0gUmVzb2x2ZXMgd2hlbiBhdXRoZW50aWNhdGlvbiBzdWNjZWVkZWQuXG4gKi9cbmFwcC5zaWduZWRJbiA9IGZ1bmN0aW9uKHByb2ZpbGUpIHtcbiAgaWYgKHByb2ZpbGUgJiYgcHJvZmlsZS5uYW1lICYmIHByb2ZpbGUuZW1haWwpIHtcbiAgICBhcHAudXNlclByb2ZpbGUgPSB7XG4gICAgICBpZDogICAgICAgcHJvZmlsZS5pZCxcbiAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICBlbWFpbDogICAgcHJvZmlsZS5lbWFpbCxcbiAgICAgIGltYWdlVXJsOiBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HXG4gICAgfTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHByb2ZpbGUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuICB9XG59O1xuXG4vKipcbiAqIFBvbHltZXIgZXZlbnQgaGFuZGxlciB0byBzaG93IGEgdG9hc3QuXG4gKiBAcGFyYW0gIHtFdmVudH0gZSBQb2x5bWVyIGN1c3RvbSBldmVudCBvYmplY3RcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5zaG93VG9hc3QgPSBmdW5jdGlvbihlKSB7XG4gIHRoaXMuJC50b2FzdC50ZXh0ID0gZS5kZXRhaWwudGV4dDtcbiAgdGhpcy4kLnRvYXN0LnNob3coKTtcbn07XG5cbi8qKlxuICogSW52b2tlZCB3aGVuICdTaWduLUluJyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybSBhdXRvLXNpZ24taW4gYW5kXG4gKiBvcGVuIGRpYWxvZyBpZiBpdCBmYWlscy5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vcGVuRGlhbG9nID0gZnVuY3Rpb24oKSB7XG4gIC8vIFRyeSBhdXRvIHNpZ24taW4gYmVmb3JlIG9wZW5pbmcgdGhlIGRpYWxvZ1xuICBhcHAuX2F1dG9TaWduSW4oZmFsc2UpXG4gIC50aGVuKHByb2ZpbGUgPT4ge1xuICAgIC8vIFdoZW4gYXV0byBzaWduLWluIGRpZG4ndCByZXNvbHZlIHdpdGggYSBwcm9maWxlXG4gICAgLy8gaXQncyBmYWlsZWQgdG8gZ2V0IGNyZWRlbnRpYWwgaW5mb3JtYXRpb24uXG4gICAgLy8gT3BlbiB0aGUgZm9ybSBzbyB0aGUgdXNlciBjYW4gZW50ZXIgaWQvcGFzc3dvcmRcbiAgICAvLyBvciBzZWxlY3QgZmVkZXJhdGVkIGxvZ2luIG1hbnVhbGx5XG4gICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICBhcHAuJC5kaWFsb2cub3BlbigpO1xuICAgIH1cbiAgfSwgKCkgPT4ge1xuICAgIGFwcC4kLmRpYWxvZy5vcGVuKCk7XG4gICAgLy8gV2hlbiByZWplY3RlZCwgYXV0aGVudGljYXRpb24gd2FzIHBlcmZvcm1lZCBidXQgZmFpbGVkLlxuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCdcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vLyBJbml0aWFsaXNlIEZhY2Vib29rIExvZ2luXG5GQi5pbml0KHtcbiAgLy8gUmVwbGFjZSB0aGlzIHdpdGggeW91ciBvd24gQXBwIElEXG4gIGFwcElkOiAgICBGQl9BUFBJRCxcbiAgY29va2llOiAgIHRydWUsXG4gIHhmYm1sOiAgICBmYWxzZSxcbiAgdmVyc2lvbjogICd2Mi41J1xufSk7XG5cbi8vIEluaXRpYWxpc2UgR29vZ2xlIFNpZ24tSW5cbmdhcGkubG9hZCgnYXV0aDInLCBmdW5jdGlvbigpIHtcbiAgZ2FwaS5hdXRoMi5pbml0KClcbiAgLnRoZW4oKCkgPT4ge1xuICAgIC8vIFRyeSBhdXRvIHNpZ24taW4gcGVyZm9ybWFuY2UgYWZ0ZXIgaW5pdGlhbGl6YXRpb25cbiAgICBhcHAuX2F1dG9TaWduSW4odHJ1ZSk7XG4gIH0pO1xufSk7XG4iXX0=
