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
  var _ref = _asyncToGenerator(function* (provider, form = new FormData()) {
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

    let res = yield fetch(url, {
      method: 'POST',
      // `credentials:'include'` is required to include cookies on `fetch`
      credentials: 'include',
      headers: {
        // `X-Requested-With` header to avoid CSRF attacks
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: form
    });
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
            // Change form `id` name to `email`
            let form = new FormData();
            form.append('email', cred.id);
            form.append('password', cred.password);
            promise = app._fetch(PASSWORD_LOGIN, form);
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
      navigator.credentials.requireUserMediation();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyJdLCJuYW1lcyI6WyJQQVNTV09SRF9MT0dJTiIsIkdPT0dMRV9TSUdOSU4iLCJGQUNFQk9PS19MT0dJTiIsIlJFR0lTVEVSIiwiVU5SRUdJU1RFUiIsIlNJR05PVVQiLCJERUZBVUxUX0lNRyIsImFwcCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsImNtYUVuYWJsZWQiLCJuYXZpZ2F0b3IiLCJjcmVkZW50aWFscyIsInNlbGVjdGVkIiwidXNlclByb2ZpbGUiLCJsaXN0ZW5lcnMiLCJfZmV0Y2giLCJwcm92aWRlciIsImZvcm0iLCJGb3JtRGF0YSIsInVybCIsInJlcyIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsImJvZHkiLCJzdGF0dXMiLCJqc29uIiwiUHJvbWlzZSIsInJlamVjdCIsIl9hdXRvU2lnbkluIiwic2lsZW50IiwiY3JlZCIsImdldCIsInBhc3N3b3JkIiwiZmVkZXJhdGVkIiwicHJvdmlkZXJzIiwibWVkaWF0aW9uIiwiY29uc29sZSIsImxvZyIsInByb21pc2UiLCJ0eXBlIiwiYXBwZW5kIiwiaWQiLCJnU2lnbkluIiwiZmJTaWduSW4iLCJ0aGVuIiwic2lnbmVkSW4iLCJyZXNvbHZlIiwib25Qd1NpZ25JbiIsImUiLCJwcmV2ZW50RGVmYXVsdCIsInNpZ25pbkZvcm0iLCJ0YXJnZXQiLCJ2YWxpZGF0ZSIsInByb2ZpbGUiLCIkIiwiZGlhbG9nIiwiY2xvc2UiLCJQYXNzd29yZENyZWRlbnRpYWwiLCJuYW1lIiwic3RvcmUiLCJmaXJlIiwidGV4dCIsIm9uR1NpZ25JbiIsIkZlZGVyYXRlZENyZWRlbnRpYWwiLCJlbWFpbCIsImljb25VUkwiLCJpbWFnZVVybCIsImF1dGgyIiwiZ2FwaSIsImdldEF1dGhJbnN0YW5jZSIsImlzU2lnbmVkSW4iLCJnb29nbGVVc2VyIiwiY3VycmVudFVzZXIiLCJnZXRCYXNpY1Byb2ZpbGUiLCJnZXRFbWFpbCIsInNpZ25JbiIsImxvZ2luX2hpbnQiLCJnZXRBdXRoUmVzcG9uc2UiLCJpZF90b2tlbiIsIm9uRmJTaWduSW4iLCJGQiIsImdldExvZ2luU3RhdHVzIiwibG9naW4iLCJzY29wZSIsImF1dGhSZXNwb25zZSIsImFjY2Vzc1Rva2VuIiwib25SZWdpc3RlciIsInJlZ0Zvcm0iLCJvblVucmVnaXN0ZXIiLCJyZXF1aXJlVXNlck1lZGlhdGlvbiIsImVycm9yIiwic2lnbk91dCIsInNob3dUb2FzdCIsInRvYXN0IiwiZGV0YWlsIiwic2hvdyIsIm9wZW5EaWFsb2ciLCJvcGVuIiwiaW5pdCIsImFwcElkIiwiRkJfQVBQSUQiLCJjb29raWUiLCJ4ZmJtbCIsInZlcnNpb24iLCJsb2FkIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxNQUFNQSxpQkFBaUIsVUFBdkI7QUFDQSxNQUFNQyxnQkFBaUIsNkJBQXZCO0FBQ0EsTUFBTUMsaUJBQWlCLDBCQUF2QjtBQUNBLE1BQU1DLFdBQWlCLFVBQXZCO0FBQ0EsTUFBTUMsYUFBaUIsWUFBdkI7QUFDQSxNQUFNQyxVQUFpQixTQUF2QjtBQUNBLE1BQU1DLGNBQWlCLHlCQUF2Qjs7QUFFQTs7OztBQUlBLElBQUlDLE1BQU1DLFNBQVNDLGFBQVQsQ0FBdUIsTUFBdkIsQ0FBVjtBQUNBRixJQUFJRyxVQUFKLEdBQWlCLENBQUMsQ0FBQ0MsVUFBVUMsV0FBN0I7QUFDQTtBQUNBTCxJQUFJTSxRQUFKLEdBQWUsQ0FBZjtBQUNBO0FBQ0FOLElBQUlPLFdBQUosR0FBa0IsSUFBbEI7QUFDQTtBQUNBUCxJQUFJUSxTQUFKLEdBQWdCO0FBQ2QsZ0JBQWM7QUFEQSxDQUFoQjs7QUFJQTs7Ozs7O0FBTUFSLElBQUlTLE1BQUo7QUFBQSwrQkFBYSxXQUFlQyxRQUFmLEVBQXlCQyxPQUFPLElBQUlDLFFBQUosRUFBaEMsRUFBZ0Q7QUFDM0QsUUFBSUMsTUFBTSxFQUFWO0FBQ0EsWUFBUUgsUUFBUjtBQUNFLFdBQUtmLGNBQUw7QUFDRWtCLGNBQU0sZ0JBQU47QUFDQTtBQUNGLFdBQUtuQixhQUFMO0FBQ0VtQixjQUFNLGNB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TSxNQUFNO0FBQ1Y7QUFDQXZDLFFBQUl1QixXQUFKLENBQWdCLElBQWhCO0FBQ0QsR0FKRDtBQUtELENBTkQiLCJmaWxlIjoiYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICogQ29weXJpZ2h0IDIwMTYgR29vZ2xlIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuY29uc3QgUEFTU1dPUkRfTE9HSU4gPSAncGFzc3dvcmQnO1xuY29uc3QgR09PR0xFX1NJR05JTiAgPSAnaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tJztcbmNvbnN0IEZBQ0VCT09LX0xPR0lOID0gJ2h0dHBzOi8vd3d3LmZhY2Vib29rLmNvbSc7XG5jb25zdCBSRUdJU1RFUiAgICAgICA9ICdyZWdpc3Rlcic7XG5jb25zdCBVTlJFR0lTVEVSICAgICA9ICd1bnJlZ2lzdGVyJztcbmNvbnN0IFNJR05PVVQgICAgICAgID0gJ3NpbmdvdXQnO1xuY29uc3QgREVGQVVMVF9JTUcgICAgPSAnL2ltYWdlcy9kZWZhdWx0X2ltZy5wbmcnO1xuXG4vKlxuICBBbHRob3VnaCB0aGlzIHNhbXBsZSBhcHAgaXMgdXNpbmcgUG9seW1lciwgbW9zdCBvZiB0aGUgaW50ZXJhY3Rpb25zIGFyZVxuICBoYW5kbGVkIHVzaW5nIHJlZ3VsYXIgQVBJcyBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBsZWFybiBhYm91dCBpdC5cbiAqL1xubGV0IGFwcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNhcHAnKTtcbmFwcC5jbWFFbmFibGVkID0gISFuYXZpZ2F0b3IuY3JlZGVudGlhbHM7XG4vLyBgc2VsZWN0ZWRgIGlzIHVzZWQgdG8gc2hvdyBhIHBvcnRpb24gb2Ygb3VyIHBhZ2VcbmFwcC5zZWxlY3RlZCA9IDA7XG4vLyBVc2VyIHByb2ZpbGUgYXV0b21hdGljYWxseSBzaG93IHVwIHdoZW4gYW4gb2JqZWN0IGlzIHNldC5cbmFwcC51c2VyUHJvZmlsZSA9IG51bGw7XG4vLyBTZXQgYW4gZXZlbnQgbGlzdGVuZXIgdG8gc2hvdyBhIHRvYXN0LiAoUG9seW1lcilcbmFwcC5saXN0ZW5lcnMgPSB7XG4gICdzaG93LXRvYXN0JzogJ3Nob3dUb2FzdCdcbn07XG5cbi8qKlxuICogQXV0aGVudGljYXRpb24gZmxvdyB3aXRoIG91ciBvd24gc2VydmVyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHByb3ZpZGVyIENyZWRlbnRpYWwgdHlwZSBzdHJpbmcuXG4gKiBAcGFyYW0gIHtGb3JtRGF0YX0gZm9ybSBGb3JtRGF0YSB0byBQT1NUIHRvIHRoZSBzZXJ2ZXJcbiAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gc3VjY2Vzc2Z1bGx5IGF1dGhlbnRpY2F0ZWRcbiAqL1xuYXBwLl9mZXRjaCA9IGFzeW5jIGZ1bmN0aW9uKHByb3ZpZGVyLCBmb3JtID0gbmV3IEZvcm1EYXRhKCkpIHtcbiAgbGV0IHVybCA9ICcnO1xuICBzd2l0Y2ggKHByb3ZpZGVyKSB7XG4gICAgY2FzZSBGQUNFQk9PS19MT0dJTjpcbiAgICAgIHVybCA9ICcvYXV0aC9mYWNlYm9vayc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIEdPT0dMRV9TSUdOSU46XG4gICAgICB1cmwgPSAnL2F1dGgvZ29vZ2xlJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgUEFTU1dPUkRfTE9HSU46XG4gICAgICB1cmwgPSAnL2F1dGgvcGFzc3dvcmQnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBSRUdJU1RFUjpcbiAgICAgIHVybCA9ICcvcmVnaXN0ZXInO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBVTlJFR0lTVEVSOlxuICAgICAgdXJsID0gJy91bnJlZ2lzdGVyJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgU0lHTk9VVDpcbiAgICAgIHVybCA9ICcvc2lnbm91dCc7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIGxldCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6ICAgICAgJ1BPU1QnLFxuICAgIC8vIGBjcmVkZW50aWFsczonaW5jbHVkZSdgIGlzIHJlcXVpcmVkIHRvIGluY2x1ZGUgY29va2llcyBvbiBgZmV0Y2hgXG4gICAgY3JlZGVudGlhbHM6ICdpbmNsdWRlJyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAvLyBgWC1SZXF1ZXN0ZWQtV2l0aGAgaGVhZGVyIHRvIGF2b2lkIENTUkYgYXR0YWNrc1xuICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnWE1MSHR0cFJlcXVlc3QnXG4gICAgfSxcbiAgICBib2R5OiAgICAgICAgZm9ybVxuICB9KTtcbiAgLy8gQ29udmVydCBKU09OIHN0cmluZyB0byBhbiBvYmplY3RcbiAgaWYgKHJlcy5zdGF0dXMgPT09IDIwMCkge1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuICB9XG59O1xuXG4vKipcbiAqIExldCB1c2VycyBzaWduLWluIHdpdGhvdXQgdHlwaW5nIGNyZWRlbnRpYWxzXG4gKiBAcGFyYW0gIHtCb29sZWFufSBzaWxlbnQgRGV0ZXJtaW5lcyBpZiBhY2NvdW50IGNob29zZXIgc2hvdWxkbid0IGJlXG4gKiBkaXNwbGF5ZWQuXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyBpZiBjcmVkZW50aWFsIGluZm8gaXMgYXZhaWxhYmxlLlxuICovXG5hcHAuX2F1dG9TaWduSW4gPSBhc3luYyBmdW5jdGlvbihzaWxlbnQpIHtcbiAgaWYgKGFwcC5jbWFFbmFibGVkKSB7XG4gICAgLy8gQWN0dWFsIENyZWRlbnRpYWwgTWFuYWdlbWVudCBBUEkgY2FsbCB0byBnZXQgY3JlZGVudGlhbCBvYmplY3RcbiAgICBsZXQgY3JlZCA9IGF3YWl0IG5hdmlnYXRvci5jcmVkZW50aWFscy5nZXQoe1xuICAgICAgcGFzc3dvcmQ6IHRydWUsXG4gICAgICBmZWRlcmF0ZWQ6IHtcbiAgICAgICAgcHJvdmlkZXJzOiBbR09PR0xFX1NJR05JTiwgRkFDRUJPT0tfTE9HSU5dXG4gICAgICB9LFxuICAgICAgbWVkaWF0aW9uOiBzaWxlbnQgPyAnc2lsZW50JyA6ICdvcHRpb25hbCdcbiAgICB9KTtcbiAgICAvLyBJZiBjcmVkZW50aWFsIG9iamVjdCBpcyBhdmFpbGFibGVcbiAgICBpZiAoY3JlZCkge1xuICAgICAgY29uc29sZS5sb2coJ2F1dG8gc2lnbi1pbiBwZXJmb3JtZWQnKTtcblxuICAgICAgbGV0IHByb21pc2U7XG4gICAgICBzd2l0Y2ggKGNyZWQudHlwZSkge1xuICAgICAgICBjYXNlICdwYXNzd29yZCc6XG4gICAgICAgICAgLy8gQ2hhbmdlIGZvcm0gYGlkYCBuYW1lIHRvIGBlbWFpbGBcbiAgICAgICAgICBsZXQgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAgIGZvcm0uYXBwZW5kKCdlbWFpbCcsIGNyZWQuaWQpO1xuICAgICAgICAgIGZvcm0uYXBwZW5kKCdwYXNzd29yZCcsIGNyZWQucGFzc3dvcmQpO1xuICAgICAgICAgIHByb21pc2UgPSBhcHAuX2ZldGNoKFBBU1NXT1JEX0xPR0lOLCBmb3JtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZmVkZXJhdGVkJzpcbiAgICAgICAgICBzd2l0Y2ggKGNyZWQucHJvdmlkZXIpIHtcbiAgICAgICAgICAgIGNhc2UgR09PR0xFX1NJR05JTjpcbiAgICAgICAgICAgICAgLy8gUmV0dXJuIFByb21pc2UgZnJvbSBgZ1NpZ25JbmBcbiAgICAgICAgICAgICAgcHJvbWlzZSA9IGFwcC5nU2lnbkluKGNyZWQuaWQpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgRkFDRUJPT0tfTE9HSU46XG4gICAgICAgICAgICAgIC8vIFJldHVybiBQcm9taXNlIGZyb20gYGZiU2lnbkluYFxuICAgICAgICAgICAgICBwcm9taXNlID0gYXBwLmZiU2lnbkluKCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChwcm9taXNlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oYXBwLnNpZ25lZEluKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ2F1dG8gc2lnbi1pbiBub3QgcGVyZm9ybWVkJyk7XG5cbiAgICAgIC8vIFJlc29sdmUgaWYgY3JlZGVudGlhbCBvYmplY3QgaXMgbm90IGF2YWlsYWJsZVxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBSZXNvbHZlIGlmIENyZWRlbnRpYWwgTWFuYWdlbWVudCBBUEkgaXMgbm90IGF2YWlsYWJsZVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBXaGVuIHBhc3N3b3JkIHNpZ24taW4gYnV0dG9uIGlzIHByZXNzZWQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAub25Qd1NpZ25JbiA9IGZ1bmN0aW9uKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gIGxldCBzaWduaW5Gb3JtID0gZS50YXJnZXQ7XG5cbiAgLy8gUG9seW1lciBgaXJvbi1mb3JtYCBmZWF0dXJlIHRvIHZhbGlkYXRlIHRoZSBmb3JtXG4gIGlmICghc2lnbmluRm9ybS52YWxpZGF0ZSgpKSByZXR1cm47XG5cbiAgbGV0IGZvcm0gPSBuZXcgRm9ybURhdGEoc2lnbmluRm9ybSk7XG5cbiAgLy8gU2lnbi1JbiB3aXRoIG91ciBvd24gc2VydmVyXG4gIGFwcC5fZmV0Y2goUEFTU1dPUkRfTE9HSU4sIGZvcm0pXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENvbnN0cnVjdCBgRm9ybURhdGFgIG9iamVjdCBmcm9tIGFjdHVhbCBgZm9ybWBcbiAgICAgIGxldCBjcmVkID0gbmV3IFBhc3N3b3JkQ3JlZGVudGlhbChzaWduaW5Gb3JtKTtcbiAgICAgIGNyZWQubmFtZSA9IHByb2ZpbGUubmFtZTtcblxuICAgICAgLy8gU3RvcmUgY3JlZGVudGlhbCBpbmZvcm1hdGlvbiBiZWZvcmUgcG9zdGluZ1xuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnN0b3JlKGNyZWQpO1xuICAgIH1cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdZb3UgYXJlIHNpZ25lZCBpbidcbiAgICB9KTtcbiAgfSwgKCkgPT4ge1xuICAgIC8vIFBvbHltZXIgZXZlbnQgdG8gbm90aWNlIHVzZXIgdGhhdCAnQXV0aGVudGljYXRpb24gZmFpbGVkJy5cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBXaGVuIGdvb2dsZSBzaWduLWluIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuYXBwLm9uR1NpZ25JbiA9IGZ1bmN0aW9uKCkge1xuICBhcHAuZ1NpZ25JbigpXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENyZWF0ZSBgQ3JlZGVudGlhbGAgb2JqZWN0IGZvciBmZWRlcmF0aW9uXG4gICAgICB2YXIgY3JlZCA9IG5ldyBGZWRlcmF0ZWRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICAgIGljb25VUkw6ICBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HLFxuICAgICAgICBwcm92aWRlcjogR09PR0xFX1NJR05JTlxuICAgICAgfSk7XG4gICAgICAvLyBTdG9yZSBjcmVkZW50aWFsIGluZm9ybWF0aW9uIGFmdGVyIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb25cbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnWW91IGFyZSBzaWduZWQgaW4nXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICAvLyBQb2x5bWVyIGV2ZW50IHRvIG5vdGljZSB1c2VyIHRoYXQgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcuXG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnQXV0aGVudGljYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogTGV0IHVzZXIgc2lnbi1pbiB1c2luZyBHb29nbGUgU2lnbi1pblxuICogQHBhcmFtICB7U3RyaW5nfSBpZCBQcmVmZXJyZWQgR21haWwgYWRkcmVzcyBmb3IgdXNlciB0byBzaWduLWluXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXR1cm5zIHJlc3VsdCBvZiBhdXRoRmxvd1xuICovXG5hcHAuZ1NpZ25JbiA9IGZ1bmN0aW9uKGlkKSB7XG4gIC8vIFJldHVybiBQcm9taXNlIGFmdGVyIEZhY2Vib29rIExvZ2luIGRhbmNlLlxuICByZXR1cm4gKCgpID0+IHtcbiAgICBsZXQgYXV0aDIgPSBnYXBpLmF1dGgyLmdldEF1dGhJbnN0YW5jZSgpO1xuICAgIGlmIChhdXRoMi5pc1NpZ25lZEluLmdldCgpKSB7XG4gICAgICAvLyBDaGVjayBpZiBjdXJyZW50bHkgc2lnbmVkIGluIHVzZXIgaXMgdGhlIHNhbWUgYXMgaW50ZW5kZWQuXG4gICAgICBsZXQgZ29vZ2xlVXNlciA9IGF1dGgyLmN1cnJlbnRVc2VyLmdldCgpO1xuICAgICAgaWYgKGdvb2dsZVVzZXIuZ2V0QmFzaWNQcm9maWxlKCkuZ2V0RW1haWwoKSA9PT0gaWQpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShnb29nbGVVc2VyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgdGhlIHVzZXIgaXMgbm90IHNpZ25lZCBpbiB3aXRoIGV4cGVjdGVkIGFjY291bnQsIGxldCBzaWduIGluLlxuICAgIHJldHVybiBhdXRoMi5zaWduSW4oe1xuICAgICAgLy8gU2V0IGBsb2dpbl9oaW50YCB0byBzcGVjaWZ5IGFuIGludGVuZGVkIHVzZXIgYWNjb3VudCxcbiAgICAgIC8vIG90aGVyd2lzZSB1c2VyIHNlbGVjdGlvbiBkaWFsb2cgd2lsbCBwb3B1cC5cbiAgICAgIGxvZ2luX2hpbnQ6IGlkIHx8ICcnXG4gICAgfSk7XG4gIH0pKCkudGhlbihnb29nbGVVc2VyID0+IHtcbiAgICAvLyBOb3cgdXNlciBpcyBzdWNjZXNzZnVsbHkgYXV0aGVudGljYXRlZCB3aXRoIEdvb2dsZS5cbiAgICAvLyBTZW5kIElEIFRva2VuIHRvIHRoZSBzZXJ2ZXIgdG8gYXV0aGVudGljYXRlIHdpdGggb3VyIHNlcnZlci5cbiAgICBsZXQgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm0uYXBwZW5kKCdpZF90b2tlbicsIGdvb2dsZVVzZXIuZ2V0QXV0aFJlc3BvbnNlKCkuaWRfdG9rZW4pO1xuICAgIHJldHVybiBhcHAuX2ZldGNoKEdPT0dMRV9TSUdOSU4sIGZvcm0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogV2hlbiBmYWNlYm9vayBsb2dpbiBidXR0b24gaXMgcHJlc3NlZC5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vbkZiU2lnbkluID0gZnVuY3Rpb24oKSB7XG4gIGFwcC5mYlNpZ25JbigpXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIENyZWF0ZSBgQ3JlZGVudGlhbGAgb2JqZWN0IGZvciBmZWRlcmF0aW9uXG4gICAgICB2YXIgY3JlZCA9IG5ldyBGZWRlcmF0ZWRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICAgIGljb25VUkw6ICBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HLFxuICAgICAgICBwcm92aWRlcjogRkFDRUJPT0tfTE9HSU5cbiAgICAgIH0pO1xuICAgICAgLy8gU3RvcmUgY3JlZGVudGlhbCBpbmZvcm1hdGlvbiBhZnRlciBzdWNjZXNzZnVsIGF1dGhlbnRpY2F0aW9uXG4gICAgICBuYXZpZ2F0b3IuY3JlZGVudGlhbHMuc3RvcmUoY3JlZCk7XG4gICAgfVxuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ1lvdSBhcmUgc2lnbmVkIGluJ1xuICAgIH0pO1xuICB9LCAoKSA9PiB7XG4gICAgLy8gUG9seW1lciBldmVudCB0byBub3RpY2UgdXNlciB0aGF0ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnLlxuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCdcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIExldCB1c2VyIHNpZ24taW4gdXNpbmcgRmFjZWJvb2sgTG9naW5cbiAqIEByZXR1cm4ge1Byb21pc2V9IFJldHVybnMgcmVzdWx0IG9mIGF1dGhGbG93XG4gKi9cbmFwcC5mYlNpZ25JbiA9IGZ1bmN0aW9uKCkge1xuICAvLyBSZXR1cm4gUHJvbWlzZSBhZnRlciBGYWNlYm9vayBMb2dpbiBkYW5jZS5cbiAgcmV0dXJuICgoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgIEZCLmdldExvZ2luU3RhdHVzKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICBpZiAocmVzLnN0YXR1cyA9PSAnY29ubmVjdGVkJykge1xuICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBGQi5sb2dpbihyZXNvbHZlLCB7c2NvcGU6ICdlbWFpbCd9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKCkudGhlbihyZXMgPT4ge1xuICAgIC8vIE9uIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb24gd2l0aCBGYWNlYm9va1xuICAgIGlmIChyZXMuc3RhdHVzID09ICdjb25uZWN0ZWQnKSB7XG4gICAgICAvLyBGb3IgRmFjZWJvb2ssIHdlIHVzZSB0aGUgQWNjZXNzIFRva2VuIHRvIGF1dGhlbnRpY2F0ZS5cbiAgICAgIGxldCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICBmb3JtLmFwcGVuZCgnYWNjZXNzX3Rva2VuJywgcmVzLmF1dGhSZXNwb25zZS5hY2Nlc3NUb2tlbik7XG4gICAgICByZXR1cm4gYXBwLl9mZXRjaChGQUNFQk9PS19MT0dJTiwgZm9ybSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdoZW4gYXV0aGVudGljYXRpb24gd2FzIHJlamVjdGVkIGJ5IEZhY2Vib29rXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1JlZ2lzdGVyJyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybXMgcmVnaXN0cmF0aW9uIGZsb3dcbiAqIGFuZCBsZXQgdXNlciBzaWduLWluLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuYXBwLm9uUmVnaXN0ZXIgPSBmdW5jdGlvbihlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKTtcblxuICBsZXQgcmVnRm9ybSA9IGUudGFyZ2V0O1xuXG4gIC8vIFBvbHltZXIgYGlyb24tZm9ybWAgZmVhdHVyZSB0byB2YWxpZGF0ZSB0aGUgZm9ybVxuICBpZiAoIXJlZ0Zvcm0udmFsaWRhdGUoKSkgcmV0dXJuO1xuXG4gIGFwcC5fZmV0Y2goUkVHSVNURVIsIG5ldyBGb3JtRGF0YShyZWdGb3JtKSlcbiAgLnRoZW4oYXBwLnNpZ25lZEluKVxuICAudGhlbihwcm9maWxlID0+IHtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdUaGFua3MgZm9yIHNpZ25pbmcgdXAhJ1xuICAgIH0pO1xuXG4gICAgaWYgKGFwcC5jbWFFbmFibGVkKSB7XG4gICAgICAvLyBDcmVhdGUgcGFzc3dvcmQgY3JlZGVudGlhbFxuICAgICAgbGV0IGNyZWQgPSBuZXcgUGFzc3dvcmRDcmVkZW50aWFsKHJlZ0Zvcm0pO1xuICAgICAgY3JlZC5uYW1lID0gcHJvZmlsZS5uYW1lO1xuICAgICAgY3JlZC5pY29uVVJMID0gcHJvZmlsZS5pbWFnZVVybDtcblxuICAgICAgLy8gU3RvcmUgdXNlciBpbmZvcm1hdGlvbiBhcyB0aGlzIGlzIHJlZ2lzdHJhdGlvbiB1c2luZyBpZC9wYXNzd29yZFxuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnN0b3JlKGNyZWQpO1xuICAgIH1cbiAgfSwgKCkgPT4ge1xuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ1JlZ2lzdHJhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1VucmVnaXN0ZXInIGJ1dHRvbiBpcyBwcmVzc2VkLCB1bnJlZ2lzdGVycyB1c2VyLlxuICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG4gKi9cbmFwcC5vblVucmVnaXN0ZXIgPSBmdW5jdGlvbigpIHtcbiAgLy8gUE9TVCBgaWRgIHRvIGAvdW5yZWdpc3RlcmAgdG8gdW5yZWdpc3RlciB0aGUgdXNlclxuICBsZXQgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICBmb3JtLmFwcGVuZCgnaWQnLCBhcHAudXNlclByb2ZpbGUuaWQpO1xuXG4gIGFwcC5fZmV0Y2goVU5SRUdJU1RFUiwgZm9ybSlcbiAgLnRoZW4oKCkgPT4ge1xuICAgIGlmIChhcHAuY21hRW5hYmxlZCkge1xuICAgICAgLy8gVHVybiBvbiB0aGUgbWVkaWF0aW9uIG1vZGUgc28gYXV0byBzaWduLWluIHdvbid0IGhhcHBlblxuICAgICAgLy8gdW50aWwgbmV4dCB0aW1lIHVzZXIgaW50ZW5kZWQgdG8gZG8gc28uXG4gICAgICBuYXZpZ2F0b3IuY3JlZGVudGlhbHMucmVxdWlyZVVzZXJNZWRpYXRpb24oKTtcbiAgICB9XG4gICAgYXBwLnVzZXJQcm9maWxlID0gbnVsbDtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6IFwiWW91J3JlIHVucmVnaXN0ZXJlZC5cIlxuICAgIH0pO1xuICAgIGFwcC5zZWxlY3RlZCA9IDA7XG4gIH0sIGUgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnRmFpbGVkIHRvIHVucmVnaXN0ZXInXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1NpZ24tb3V0JyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybXMgc2lnbi1vdXQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAuc2lnbk91dCA9IGZ1bmN0aW9uKCkge1xuICBhcHAuX2ZldGNoKFNJR05PVVQpXG4gIC50aGVuKCgpID0+IHtcbiAgICBpZiAoYXBwLmNtYUVuYWJsZWQpIHtcbiAgICAgIC8vIFR1cm4gb24gdGhlIG1lZGlhdGlvbiBtb2RlIHNvIGF1dG8gc2lnbi1pbiB3b24ndCBoYXBwZW5cbiAgICAgIC8vIHVudGlsIG5leHQgdGltZSB1c2VyIGludGVuZGVkIHRvIGRvIHNvLlxuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnJlcXVpcmVVc2VyTWVkaWF0aW9uKCk7XG4gICAgfVxuICAgIGFwcC51c2VyUHJvZmlsZSA9IG51bGw7XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiBcIllvdSdyZSBzaWduZWQgb3V0LlwiXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdGYWlsZWQgdG8gc2lnbiBvdXQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBVc2VyIGlzIHNpZ25lZCBpbi4gRmlsbCB1c2VyIGluZm8uXG4gKiBAcGFyYW0gIHtPYmplY3R9IHByb2ZpbGUgUHJvZmlsZSBpbmZvcm1hdGlvbiBvYmplY3RcbiAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gYXV0aGVudGljYXRpb24gc3VjY2VlZGVkLlxuICovXG5hcHAuc2lnbmVkSW4gPSBmdW5jdGlvbihwcm9maWxlKSB7XG4gIGlmIChwcm9maWxlICYmIHByb2ZpbGUubmFtZSAmJiBwcm9maWxlLmVtYWlsKSB7XG4gICAgYXBwLnVzZXJQcm9maWxlID0ge1xuICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuaWQsXG4gICAgICBuYW1lOiAgICAgcHJvZmlsZS5uYW1lLFxuICAgICAgZW1haWw6ICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICBpbWFnZVVybDogcHJvZmlsZS5pbWFnZVVybCB8fCBERUZBVUxUX0lNR1xuICAgIH07XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShwcm9maWxlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBQb2x5bWVyIGV2ZW50IGhhbmRsZXIgdG8gc2hvdyBhIHRvYXN0LlxuICogQHBhcmFtICB7RXZlbnR9IGUgUG9seW1lciBjdXN0b20gZXZlbnQgb2JqZWN0XG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAuc2hvd1RvYXN0ID0gZnVuY3Rpb24oZSkge1xuICB0aGlzLiQudG9hc3QudGV4dCA9IGUuZGV0YWlsLnRleHQ7XG4gIHRoaXMuJC50b2FzdC5zaG93KCk7XG59O1xuXG4vKipcbiAqIEludm9rZWQgd2hlbiAnU2lnbi1JbicgYnV0dG9uIGlzIHByZXNzZWQsIHBlcmZvcm0gYXV0by1zaWduLWluIGFuZFxuICogb3BlbiBkaWFsb2cgaWYgaXQgZmFpbHMuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAub3BlbkRpYWxvZyA9IGZ1bmN0aW9uKCkge1xuICAvLyBUcnkgYXV0byBzaWduLWluIGJlZm9yZSBvcGVuaW5nIHRoZSBkaWFsb2dcbiAgYXBwLl9hdXRvU2lnbkluKGZhbHNlKVxuICAudGhlbihwcm9maWxlID0+IHtcbiAgICAvLyBXaGVuIGF1dG8gc2lnbi1pbiBkaWRuJ3QgcmVzb2x2ZSB3aXRoIGEgcHJvZmlsZVxuICAgIC8vIGl0J3MgZmFpbGVkIHRvIGdldCBjcmVkZW50aWFsIGluZm9ybWF0aW9uLlxuICAgIC8vIE9wZW4gdGhlIGZvcm0gc28gdGhlIHVzZXIgY2FuIGVudGVyIGlkL3Bhc3N3b3JkXG4gICAgLy8gb3Igc2VsZWN0IGZlZGVyYXRlZCBsb2dpbiBtYW51YWxseVxuICAgIGlmICghcHJvZmlsZSkge1xuICAgICAgYXBwLiQuZGlhbG9nLm9wZW4oKTtcbiAgICB9XG4gIH0sICgpID0+IHtcbiAgICBhcHAuJC5kaWFsb2cub3BlbigpO1xuICAgIC8vIFdoZW4gcmVqZWN0ZWQsIGF1dGhlbnRpY2F0aW9uIHdhcyBwZXJmb3JtZWQgYnV0IGZhaWxlZC5cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLy8gSW5pdGlhbGlzZSBGYWNlYm9vayBMb2dpblxuRkIuaW5pdCh7XG4gIC8vIFJlcGxhY2UgdGhpcyB3aXRoIHlvdXIgb3duIEFwcCBJRFxuICBhcHBJZDogICAgRkJfQVBQSUQsXG4gIGNvb2tpZTogICB0cnVlLFxuICB4ZmJtbDogICAgZmFsc2UsXG4gIHZlcnNpb246ICAndjIuNSdcbn0pO1xuXG4vLyBJbml0aWFsaXNlIEdvb2dsZSBTaWduLUluXG5nYXBpLmxvYWQoJ2F1dGgyJywgZnVuY3Rpb24oKSB7XG4gIGdhcGkuYXV0aDIuaW5pdCgpXG4gIC50aGVuKCgpID0+IHtcbiAgICAvLyBUcnkgYXV0byBzaWduLWluIHBlcmZvcm1hbmNlIGFmdGVyIGluaXRpYWxpemF0aW9uXG4gICAgYXBwLl9hdXRvU2lnbkluKHRydWUpO1xuICB9KTtcbn0pO1xuIl19
