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
const app = document.querySelector('#app');
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

    const res = yield fetch(url, {
      method: 'POST',
      // `credentials:'include'` is required to include cookies on `fetch`
      credentials: 'include',
      headers: {
        // `X-Requested-With` header to avoid CSRF attacks
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: c
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
    if (window.PasswordCredential || window.FederatedCredential) {
      // Actual Credential Management API call to get credential object
      const cred = yield navigator.credentials.get({
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
              const form = new FormData();
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

  const signinForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!signinForm.validate()) return;

  const signinFormData = new FormData(signinForm);

  // Store the exact credentials sent to the server
  const email = signinFormData.get('email');
  const password = signinFormData.get('password');

  // Sign-In with our own server
  app._fetch(PASSWORD_LOGIN, signinFormData).then(app.signedIn).then(profile => {
    app.$.dialog.close();

    if (window.PasswordCredential) {
      // Construct `FormData` object from actual `form`
      const cred = new PasswordCredential({
        id: email,
        password: password,
        name: profile.name
      });

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

    if (window.FederatedCredential) {
      // Create `Credential` object for federation
      const cred = new FederatedCredential({
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
    const auth2 = gapi.auth2.getAuthInstance();
    if (auth2.isSignedIn.get()) {
      // Check if currently signed in user is the same as intended.
      const googleUser = auth2.currentUser.get();
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
    const form = new FormData();
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

    if (window.FederatedCredential) {
      // Create `Credential` object for federation
      const cred = new FederatedCredential({
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
      const form = new FormData();
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

  const regForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!regForm.validate()) return;

  const regFormData = new FormData(regForm);

  // Store the exact credentials sent to the server
  const email = regFormData.get('email');
  const password = regFormData.get('password');

  app._fetch(REGISTER, regFormData).then(app.signedIn).then(profile => {
    app.fire('show-toast', {
      text: 'Thanks for signing up!'
    });

    if (window.PasswordCredential) {
      // Create password credential
      const cred = new PasswordCredential({
        id: email,
        password: password,
        name: profile.name,
        iconURL: profile.imageUrl
      });

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
  const form = new FormData();
  form.append('id', app.userProfile.id);

  app._fetch(UNREGISTER, form).then(() => {
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
      // Turn on the mediation mode so auto sign-in won't happen
      // until next time user intended to do so.
      navigator.credentials.preventSilentAccess();
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
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyJdLCJuYW1lcyI6WyJQQVNTV09SRF9MT0dJTiIsIkdPT0dMRV9TSUdOSU4iLCJGQUNFQk9PS19MT0dJTiIsIlJFR0lTVEVSIiwiVU5SRUdJU1RFUiIsIlNJR05PVVQiLCJERUZBVUxUX0lNRyIsImFwcCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsInNlbGVjdGVkIiwidXNlclByb2ZpbGUiLCJsaXN0ZW5lcnMiLCJfZmV0Y2giLCJwcm92aWRlciIsImMiLCJGb3JtRGF0YSIsInVybCIsInJlcyIsImZldGNoIiwibWV0aG9kIiwiY3JlZGVudGlhbHMiLCJoZWFkZXJzIiwiYm9keSIsInN0YXR1cyIsImpzb24iLCJQcm9taXNlIiwicmVqZWN0IiwiX2F1dG9TaWduSW4iLCJzaWxlbnQiLCJ3aW5kb3ciLCJQYXNzd29yZENyZWRlbnRpYWwiLCJGZWRlcmF0ZWRDcmVkZW50aWFsIiwiY3JlZCIsIm5hdmlnYXRvciIsImdldCIsInBhc3N3b3JkIiwiZmVkZXJhdGVkIiwicHJvdmlkZXJzIiwibWVkaWF0aW9uIiwiY29uc29sZSIsImxvZyIsInByb21pc2UiLCJ0eXBlIiwidW5kZWZpbmVkIiwiaWROYW1lIiwiZm9ybSIsImFwcGVuZCIsImlkIiwiZ1NpZ25JbiIsImZiU2lnbkluIiwidGhlbiIsInNpZ25lZEluIiwicmVzb2x2ZSIsIm9uUHdTaWduSW4iLCJlIiwicHJldmVudERlZmF1bHQiLCJzaWduaW5Gb3JtIiwidGFyZ2V0IiwidmFsaWRhdGUiLCJzaWduaW5Gb3JtRGF0YSIsImVtYWlsIiwicHJvZmlsZSIsIiQiLCJkaWFsb2ciLCJjbG9zZSIsIm5hbWUiLCJzdG9yZSIsImZpcmUiLCJ0ZXh0Iiwib25HU2lnbkluIiwiaWNvblVSTCIsImltYWdlVXJsIiwiYXV0aDIiLCJnYXBpIiwiZ2V0QXV0aEluc3RhbmNlIiwiaXNTaWduZWRJbiIsImdvb2dsZVVzZXIiLCJjdXJyZW50VXNlciIsImdldEJhc2ljUHJvZmlsZSIsImdldEVtYWlsIiwic2lnbkluIiwibG9naW5faGludCIsImdldEF1dGhSZXNwb25zZSIsImlkX3Rva2VuIiwib25GYlNpZ25JbiIsIkZCIiwiZ2V0TG9naW5TdGF0dXMiLCJsb2dpbiIsInNjb3BlIiwiYXV0aFJlc3BvbnNlIiwiYWNjZXNzVG9rZW4iLCJvblJlZ2lzdGVyIiwicmVnRm9ybSIsInJlZ0Zvcm1EYXRhIiwib25VbnJlZ2lzdGVyIiwicHJldmVudFNpbGVudEFjY2VzcyIsImVycm9yIiwic2lnbk91dCIsInNob3dUb2FzdCIsInRvYXN0IiwiZGV0YWlsIiwic2hvdyIsIm9wZW5EaWFsb2ciLCJvcGVuIiwiaW5pdCIsImFwcElkIiwiRkJfQVBQSUQiLCJjb29raWUiLCJ4ZmJtbCIsInZlcnNpb24iLCJsb2FkIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxNQUFNQSxpQkFBaUIsVUFBdkI7QUFDQSxNQUFNQyxnQkFBaUIsNkJBQXZCO0FBQ0EsTUFBTUMsaUJBQWlCLDBCQUF2QjtBQUNBLE1BQU1DLFdBQWlCLFVBQXZCO0FBQ0EsTUFBTUMsYUFBaUIsWUFBdkI7QUFDQSxNQUFNQyxVQUFpQixTQUF2QjtBQUNBLE1BQU1DLGNBQWlCLHlCQUF2Qjs7QUFFQTs7OztBQUlBLE1BQU1DLE1BQU1DLFNBQVNDLGFBQVQsQ0FBdUIsTUFBdkIsQ0FBWjtBQUNBO0FBQ0FGLElBQUlHLFFBQUosR0FBZSxDQUFmO0FBQ0E7QUFDQUgsSUFBSUksV0FBSixHQUFrQixJQUFsQjtBQUNBO0FBQ0FKLElBQUlLLFNBQUosR0FBZ0I7QUFDZCxnQkFBYztBQURBLENBQWhCOztBQUlBOzs7Ozs7QUFNQUwsSUFBSU0sTUFBSjtBQUFBLCtCQUFhLFdBQWVDLFFBQWYsRUFBeUJDLElBQUksSUFBSUMsUUFBSixFQUE3QixFQUE2QztBQUN4RCxRQUFJQyxNQUFNLEVBQVY7QUFDQSxZQUFRSCxRQUFSO0FBQ0UsV0FBS1osY0FBTDtBQUNFZSxjQUFNLGdCQUFOO0FBQ0E7QUFDRixXQUFLaEIsYUFBTDtBQUNFZ0IsY0FBTSxjQUFOO0FBQ0E7QUFDRixXQUFLakIsY0FBTDtBQUNFaUIsY0FBTSxnQkFBTjtBQUNBO0FBQ0YsV0FBS2QsUUFBTDtBQUNFYyxjQUFNLFdBQU47QUFDQTtBQUNGLFdBQUtiLFVBQUw7QUFDRWEsY0FBTSxhQUFOO0FBQ0E7QUFDRixXQUFLWixPQUFMO0FBQ0VZLGNBQU0sVUFBTjtBQUNBO0FBbEJKOztBQXFCQSxVQUFNQyxNQUFNLE1BQU1DLE1BQU1GLEdBQU4sRUFBVztBQUMzQkcsY0FBUSxNQURtQjtBQUUzQjtBQUNBQyxtQkFBYSxTQUhjO0FBSTNCQyxlQUFTO0FBQ1A7QUFDQSw0QkFBb0I7QUFGYixPQUprQjtBQVEzQkMsWUFBTVI7QUFScUIsS0FBWCxDQUFsQjtBQVVBO0FBQ0EsUUFBSUcsSUFBSU0sTUFBSixLQUFlLEdBQW5CLEVBQXdCO0FBQ3RCLGFBQU9OLElBQUlPLElBQUosRUFBUDtBQUNELEtBRkQsTUFFTztBQUNMLGFBQU9DLFFBQVFDLE1BQVIsRUFBUDtBQUNEO0FBQ0YsR0F2Q0Q7O0FBQUE7QUFBQTtBQUFBO0FBQUE7O0FBeUNBOzs7Ozs7QUFNQXBCLElBQUlxQixXQUFKO0FBQUEsZ0NBQWtCLFdBQWVDLE1BQWYsRUFBdUI7QUFDdkMsUUFBSUMsT0FBT0Msa0JBQVAsSUFBNkJELE9BQU9FLG1CQUF4QyxFQUE2RDtBQUMzRDtBQUNBLFlBQU1DLE9BQU8sTUFBTUMsVUFBVWIsV0FBVixDQUFzQmMsR0FBdEIsQ0FBMEI7QUFDM0NDLGtCQUFVLElBRGlDO0FBRTNDQyxtQkFBVztBQUNUQyxxQkFBVyxDQUFDckMsYUFBRCxFQUFnQkMsY0FBaEI7QUFERixTQUZnQztBQUszQ3FDLG1CQUFXVixTQUFTLFFBQVQsR0FBb0I7QUFMWSxPQUExQixDQUFuQjtBQU9BO0FBQ0EsVUFBSUksSUFBSixFQUFVO0FBQ1JPLGdCQUFRQyxHQUFSLENBQVksd0JBQVo7O0FBRUEsWUFBSUMsT0FBSjtBQUNBLGdCQUFRVCxLQUFLVSxJQUFiO0FBQ0UsZUFBSyxVQUFMO0FBQ0U7QUFDQSxnQkFBSVYsS0FBS0csUUFBTCxLQUFrQlEsU0FBdEIsRUFBaUM7QUFDL0JYLG1CQUFLWSxNQUFMLEdBQWMsT0FBZDtBQUNBSCx3QkFBVW5DLElBQUlNLE1BQUosQ0FBV2IsY0FBWCxFQUEyQmlDLElBQTNCLENBQVY7O0FBRUY7QUFDQyxhQUxELE1BS087QUFDTDtBQUNBLG9CQUFNYSxPQUFPLElBQUk5QixRQUFKLEVBQWI7QUFDQThCLG1CQUFLQyxNQUFMLENBQVksT0FBWixFQUFxQmQsS0FBS2UsRUFBMUI7QUFDQUYsbUJBQUtDLE1BQUwsQ0FBWSxVQUFaLEVBQXdCZCxLQUFLRyxRQUE3QjtBQUNBTSx3QkFBVW5DLElBQUlNLE1BQUosQ0FBV2IsY0FBWCxFQUEyQjhDLElBQTNCLENBQVY7QUFDRDtBQUNEO0FBQ0YsZUFBSyxXQUFMO0FBQ0Usb0JBQVFiLEtBQUtuQixRQUFiO0FBQ0UsbUJBQUtiLGFBQUw7QUFDRTtBQUNBeUMsMEJBQVVuQyxJQUFJMEMsT0FBSixDQUFZaEIsS0FBS2UsRUFBakIsQ0FBVjtBQUNBO0FBQ0YsbUJBQUs5QyxjQUFMO0FBQ0U7QUFDQXdDLDBCQUFVbkMsSUFBSTJDLFFBQUosRUFBVjtBQUNBO0FBUko7QUFVQTtBQTNCSjtBQTZCQSxZQUFJUixPQUFKLEVBQWE7QUFDWCxpQkFBT0EsUUFBUVMsSUFBUixDQUFhNUMsSUFBSTZDLFFBQWpCLENBQVA7QUFDRCxTQUZELE1BRU87QUFDTCxpQkFBTzFCLFFBQVEyQixPQUFSLEVBQVA7QUFDRDtBQUNGLE9BdENELE1Bc0NPO0FBQ0xiLGdCQUFRQyxHQUFSLENBQVksNEJBQVo7O0FBRUE7QUFDQSxlQUFPZixRQUFRMkIsT0FBUixFQUFQO0FBQ0Q7QUFDRixLQXRERCxNQXNETztBQUNMO0FBQ0EsYUFBTzNCLFFBQVEyQixPQUFSLEVBQVA7QUFDRDtBQUNGLEdBM0REOztBQUFBO0FBQUE7QUFBQTtBQUFBOztBQTZEQTs7OztBQUlBOUMsSUFBSStDLFVBQUosR0FBaUIsVUFBU0MsQ0FBVCxFQUFZO0FBQzNCQSxJQUFFQyxjQUFGOztBQUVBLFFBQU1DLGFBQWFGLEVBQUVHLE1BQXJCOztBQUVBO0FBQ0EsTUFBSSxDQUFDRCxXQUFXRSxRQUFYLEVBQUwsRUFBNEI7O0FBRTVCLFFBQU1DLGlCQUFpQixJQUFJNUMsUUFBSixDQUFheUMsVUFBYixDQUF2Qjs7QUFFQTtBQUNBLFFBQU1JLFFBQVFELGVBQWV6QixHQUFmLENBQW1CLE9BQW5CLENBQWQ7QUFDQSxRQUFNQyxXQUFXd0IsZUFBZXpCLEdBQWYsQ0FBbUIsVUFBbkIsQ0FBakI7O0FBRUE7QUFDQTVCLE1BQUlNLE1BQUosQ0FBV2IsY0FBWCxFQUEyQjRELGNBQTNCLEVBQ0NULElBREQsQ0FDTTVDLElBQUk2QyxRQURWLEVBRUNELElBRkQsQ0FFTVcsV0FBVztBQUNmdkQsUUFBSXdELENBQUosQ0FBTUMsTUFBTixDQUFhQyxLQUFiOztBQUVBLFFBQUluQyxPQUFPQyxrQkFBWCxFQUErQjtBQUM3QjtBQUNBLFlBQU1FLE9BQU8sSUFBSUYsa0JBQUosQ0FBdUI7QUFDbENpQixZQUFJYSxLQUQ4QjtBQUVsQ3pCLGtCQUFVQSxRQUZ3QjtBQUdsQzhCLGNBQU1KLFFBQVFJO0FBSG9CLE9BQXZCLENBQWI7O0FBTUE7QUFDQWhDLGdCQUFVYixXQUFWLENBQXNCOEMsS0FBdEIsQ0FBNEJsQyxJQUE1QjtBQUNEO0FBQ0QxQixRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBbkJELEVBbUJHLE1BQU07QUFDUDtBQUNBOUQsUUFBSTZELElBQUosQ0FBUyxZQUFULEVBQXVCO0FBQ3JCQyxZQUFNO0FBRGUsS0FBdkI7QUFHRCxHQXhCRDtBQXlCRCxDQXhDRDs7QUEwQ0E7Ozs7QUFJQTlELElBQUkrRCxTQUFKLEdBQWdCLFlBQVc7QUFDekIvRCxNQUFJMEMsT0FBSixHQUNDRSxJQURELENBQ001QyxJQUFJNkMsUUFEVixFQUVDRCxJQUZELENBRU1XLFdBQVc7QUFDZnZELFFBQUl3RCxDQUFKLENBQU1DLE1BQU4sQ0FBYUMsS0FBYjs7QUFFQSxRQUFJbkMsT0FBT0UsbUJBQVgsRUFBZ0M7QUFDOUI7QUFDQSxZQUFNQyxPQUFPLElBQUlELG1CQUFKLENBQXdCO0FBQ25DZ0IsWUFBVWMsUUFBUUQsS0FEaUI7QUFFbkNLLGNBQVVKLFFBQVFJLElBRmlCO0FBR25DSyxpQkFBVVQsUUFBUVUsUUFBUixJQUFvQmxFLFdBSEs7QUFJbkNRLGtCQUFVYjtBQUp5QixPQUF4QixDQUFiO0FBTUE7QUFDQWlDLGdCQUFVYixXQUFWLENBQXNCOEMsS0FBdEIsQ0FBNEJsQyxJQUE1QjtBQUNEO0FBQ0QxQixRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBbkJELEVBbUJHLE1BQU07QUFDUDtBQUNBOUQsUUFBSTZELElBQUosQ0FBUyxZQUFULEVBQXVCO0FBQ3JCQyxZQUFNO0FBRGUsS0FBdkI7QUFHRCxHQXhCRDtBQXlCRCxDQTFCRDs7QUE0QkE7Ozs7O0FBS0E5RCxJQUFJMEMsT0FBSixHQUFjLFVBQVNELEVBQVQsRUFBYTtBQUN6QjtBQUNBLFNBQU8sQ0FBQyxNQUFNO0FBQ1osVUFBTXlCLFFBQVFDLEtBQUtELEtBQUwsQ0FBV0UsZUFBWCxFQUFkO0FBQ0EsUUFBSUYsTUFBTUcsVUFBTixDQUFpQnpDLEdBQWpCLEVBQUosRUFBNEI7QUFDMUI7QUFDQSxZQUFNMEMsYUFBYUosTUFBTUssV0FBTixDQUFrQjNDLEdBQWxCLEVBQW5CO0FBQ0EsVUFBSTBDLFdBQVdFLGVBQVgsR0FBNkJDLFFBQTdCLE9BQTRDaEMsRUFBaEQsRUFBb0Q7QUFDbEQsZUFBT3RCLFFBQVEyQixPQUFSLENBQWdCd0IsVUFBaEIsQ0FBUDtBQUNEO0FBQ0Y7QUFDRDtBQUNBLFdBQU9KLE1BQU1RLE1BQU4sQ0FBYTtBQUNsQjtBQUNBO0FBQ0FDLGtCQUFZbEMsTUFBTTtBQUhBLEtBQWIsQ0FBUDtBQUtELEdBZk0sSUFlRkcsSUFmRSxDQWVHMEIsY0FBYztBQUN0QjtBQUNBO0FBQ0EsVUFBTS9CLE9BQU8sSUFBSTlCLFFBQUosRUFBYjtBQUNBOEIsU0FBS0MsTUFBTCxDQUFZLFVBQVosRUFBd0I4QixXQUFXTSxlQUFYLEdBQTZCQyxRQUFyRDtBQUNBLFdBQU83RSxJQUFJTSxNQUFKLENBQVdaLGFBQVgsRUFBMEI2QyxJQUExQixDQUFQO0FBQ0QsR0FyQk0sQ0FBUDtBQXNCRCxDQXhCRDs7QUEwQkE7Ozs7QUFJQXZDLElBQUk4RSxVQUFKLEdBQWlCLFlBQVc7QUFDMUI5RSxNQUFJMkMsUUFBSixHQUNDQyxJQURELENBQ001QyxJQUFJNkMsUUFEVixFQUVDRCxJQUZELENBRU1XLFdBQVc7QUFDZnZELFFBQUl3RCxDQUFKLENBQU1DLE1BQU4sQ0FBYUMsS0FBYjs7QUFFQSxRQUFJbkMsT0FBT0UsbUJBQVgsRUFBZ0M7QUFDOUI7QUFDQSxZQUFNQyxPQUFPLElBQUlELG1CQUFKLENBQXdCO0FBQ25DZ0IsWUFBVWMsUUFBUUQsS0FEaUI7QUFFbkNLLGNBQVVKLFFBQVFJLElBRmlCO0FBR25DSyxpQkFBVVQsUUFBUVUsUUFBUixJQUFvQmxFLFdBSEs7QUFJbkNRLGtCQUFVWjtBQUp5QixPQUF4QixDQUFiO0FBTUE7QUFDQWdDLGdCQUFVYixXQUFWLENBQXNCOEMsS0FBdEIsQ0FBNEJsQyxJQUE1QjtBQUNEO0FBQ0QxQixRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBbkJELEVBbUJHLE1BQU07QUFDUDtBQUNBOUQsUUFBSTZELElBQUosQ0FBUyxZQUFULEVBQXVCO0FBQ3JCQyxZQUFNO0FBRGUsS0FBdkI7QUFHRCxHQXhCRDtBQXlCRCxDQTFCRDs7QUE0QkE7Ozs7QUFJQTlELElBQUkyQyxRQUFKLEdBQWUsWUFBVztBQUN4QjtBQUNBLFNBQU8sQ0FBQyxNQUFNO0FBQ1osV0FBTyxJQUFJeEIsT0FBSixDQUFZLFVBQVMyQixPQUFULEVBQWtCO0FBQ25DaUMsU0FBR0MsY0FBSCxDQUFrQixVQUFTckUsR0FBVCxFQUFjO0FBQzlCLFlBQUlBLElBQUlNLE1BQUosSUFBYyxXQUFsQixFQUErQjtBQUM3QjZCLGtCQUFRbkMsR0FBUjtBQUNELFNBRkQsTUFFTztBQUNMb0UsYUFBR0UsS0FBSCxDQUFTbkMsT0FBVCxFQUFrQixFQUFDb0MsT0FBTyxPQUFSLEVBQWxCO0FBQ0Q7QUFDRixPQU5EO0FBT0QsS0FSTSxDQUFQO0FBU0QsR0FWTSxJQVVGdEMsSUFWRSxDQVVHakMsT0FBTztBQUNmO0FBQ0EsUUFBSUEsSUFBSU0sTUFBSixJQUFjLFdBQWxCLEVBQStCO0FBQzdCO0FBQ0EsWUFBTXNCLE9BQU8sSUFBSTlCLFFBQUosRUFBYjtBQUNBOEIsV0FBS0MsTUFBTCxDQUFZLGNBQVosRUFBNEI3QixJQUFJd0UsWUFBSixDQUFpQkMsV0FBN0M7QUFDQSxhQUFPcEYsSUFBSU0sTUFBSixDQUFXWCxjQUFYLEVBQTJCNEMsSUFBM0IsQ0FBUDtBQUNELEtBTEQsTUFLTztBQUNMO0FBQ0EsYUFBT3BCLFFBQVFDLE1BQVIsRUFBUDtBQUNEO0FBQ0YsR0FyQk0sQ0FBUDtBQXNCRCxDQXhCRDs7QUEwQkE7Ozs7O0FBS0FwQixJQUFJcUYsVUFBSixHQUFpQixVQUFTckMsQ0FBVCxFQUFZO0FBQzNCQSxJQUFFQyxjQUFGOztBQUVBLFFBQU1xQyxVQUFVdEMsRUFBRUcsTUFBbEI7O0FBRUE7QUFDQSxNQUFJLENBQUNtQyxRQUFRbEMsUUFBUixFQUFMLEVBQXlCOztBQUV6QixRQUFNbUMsY0FBYyxJQUFJOUUsUUFBSixDQUFhNkUsT0FBYixDQUFwQjs7QUFFQTtBQUNBLFFBQU1oQyxRQUFRaUMsWUFBWTNELEdBQVosQ0FBZ0IsT0FBaEIsQ0FBZDtBQUNBLFFBQU1DLFdBQVcwRCxZQUFZM0QsR0FBWixDQUFnQixVQUFoQixDQUFqQjs7QUFFQTVCLE1BQUlNLE1BQUosQ0FBV1YsUUFBWCxFQUFxQjJGLFdBQXJCLEVBQ0MzQyxJQURELENBQ001QyxJQUFJNkMsUUFEVixFQUVDRCxJQUZELENBRU1XLFdBQVc7QUFDZnZELFFBQUk2RCxJQUFKLENBQVMsWUFBVCxFQUF1QjtBQUNyQkMsWUFBTTtBQURlLEtBQXZCOztBQUlBLFFBQUl2QyxPQUFPQyxrQkFBWCxFQUErQjtBQUM3QjtBQUNBLFlBQU1FLE9BQU8sSUFBSUYsa0JBQUosQ0FBdUI7QUFDbENpQixZQUFJYSxLQUQ4QjtBQUVsQ3pCLGtCQUFVQSxRQUZ3QjtBQUdsQzhCLGNBQU1KLFFBQVFJLElBSG9CO0FBSWxDSyxpQkFBU1QsUUFBUVU7QUFKaUIsT0FBdkIsQ0FBYjs7QUFPQTtBQUNBdEMsZ0JBQVViLFdBQVYsQ0FBc0I4QyxLQUF0QixDQUE0QmxDLElBQTVCO0FBQ0Q7QUFDRixHQW5CRCxFQW1CRyxNQUFNO0FBQ1AxQixRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBdkJEO0FBd0JELENBdENEOztBQXdDQTs7OztBQUlBOUQsSUFBSXdGLFlBQUosR0FBbUIsWUFBVztBQUM1QjtBQUNBLFFBQU1qRCxPQUFPLElBQUk5QixRQUFKLEVBQWI7QUFDQThCLE9BQUtDLE1BQUwsQ0FBWSxJQUFaLEVBQWtCeEMsSUFBSUksV0FBSixDQUFnQnFDLEVBQWxDOztBQUVBekMsTUFBSU0sTUFBSixDQUFXVCxVQUFYLEVBQXVCMEMsSUFBdkIsRUFDQ0ssSUFERCxDQUNNLE1BQU07QUFDVixRQUFJakIsVUFBVWIsV0FBVixJQUF5QmEsVUFBVWIsV0FBVixDQUFzQjJFLG1CQUFuRCxFQUF3RTtBQUN0RTtBQUNBO0FBQ0E5RCxnQkFBVWIsV0FBVixDQUFzQjJFLG1CQUF0QjtBQUNEO0FBQ0R6RixRQUFJSSxXQUFKLEdBQWtCLElBQWxCO0FBQ0FKLFFBQUk2RCxJQUFKLENBQVMsWUFBVCxFQUF1QjtBQUNyQkMsWUFBTTtBQURlLEtBQXZCO0FBR0E5RCxRQUFJRyxRQUFKLEdBQWUsQ0FBZjtBQUNELEdBWkQsRUFZRzZDLEtBQUs7QUFDTmYsWUFBUXlELEtBQVIsQ0FBYzFDLENBQWQ7QUFDQWhELFFBQUk2RCxJQUFKLENBQVMsWUFBVCxFQUF1QjtBQUNyQkMsWUFBTTtBQURlLEtBQXZCO0FBR0QsR0FqQkQ7QUFrQkQsQ0F2QkQ7O0FBeUJBOzs7O0FBSUE5RCxJQUFJMkYsT0FBSixHQUFjLFlBQVc7QUFDdkIzRixNQUFJTSxNQUFKLENBQVdSLE9BQVgsRUFDQzhDLElBREQsQ0FDTSxNQUFNO0FBQ1YsUUFBSWpCLFVBQVViLFdBQVYsSUFBeUJhLFVBQVViLFdBQVYsQ0FBc0IyRSxtQkFBbkQsRUFBd0U7QUFDdEU7QUFDQTtBQUNBOUQsZ0JBQVViLFdBQVYsQ0FBc0IyRSxtQkFBdEI7QUFDRDtBQUNEekYsUUFBSUksV0FBSixHQUFrQixJQUFsQjtBQUNBSixRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBWEQsRUFXRyxNQUFNO0FBQ1A5RCxRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBZkQ7QUFnQkQsQ0FqQkQ7O0FBbUJBOzs7OztBQUtBOUQsSUFBSTZDLFFBQUosR0FBZSxVQUFTVSxPQUFULEVBQWtCO0FBQy9CLE1BQUlBLFdBQVdBLFFBQVFJLElBQW5CLElBQTJCSixRQUFRRCxLQUF2QyxFQUE4QztBQUM1Q3RELFFBQUlJLFdBQUosR0FBa0I7QUFDaEJxQyxVQUFVYyxRQUFRZCxFQURGO0FBRWhCa0IsWUFBVUosUUFBUUksSUFGRjtBQUdoQkwsYUFBVUMsUUFBUUQsS0FIRjtBQUloQlcsZ0JBQVVWLFFBQVFVLFFBQVIsSUFBb0JsRTtBQUpkLEtBQWxCO0FBTUEsV0FBT29CLFFBQVEyQixPQUFSLENBQWdCUyxPQUFoQixDQUFQO0FBQ0QsR0FSRCxNQVFPO0FBQ0wsV0FBT3BDLFFBQVFDLE1BQVIsRUFBUDtBQUNEO0FBQ0YsQ0FaRDs7QUFjQTs7Ozs7QUFLQXBCLElBQUk0RixTQUFKLEdBQWdCLFVBQVM1QyxDQUFULEVBQVk7QUFDMUIsT0FBS1EsQ0FBTCxDQUFPcUMsS0FBUCxDQUFhL0IsSUFBYixHQUFvQmQsRUFBRThDLE1BQUYsQ0FBU2hDLElBQTdCO0FBQ0EsT0FBS04sQ0FBTCxDQUFPcUMsS0FBUCxDQUFhRSxJQUFiO0FBQ0QsQ0FIRDs7QUFLQTs7Ozs7QUFLQS9GLElBQUlnRyxVQUFKLEdBQWlCLFlBQVc7QUFDMUI7QUFDQWhHLE1BQUlxQixXQUFKLENBQWdCLEtBQWhCLEVBQ0N1QixJQURELENBQ01XLFdBQVc7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQUksQ0FBQ0EsT0FBTCxFQUFjO0FBQ1p2RCxVQUFJd0QsQ0FBSixDQUFNQyxNQUFOLENBQWF3QyxJQUFiO0FBQ0Q7QUFDRixHQVRELEVBU0csTUFBTTtBQUNQakcsUUFBSXdELENBQUosQ0FBTUMsTUFBTixDQUFhd0MsSUFBYjtBQUNBO0FBQ0FqRyxRQUFJNkQsSUFBSixDQUFTLFlBQVQsRUFBdUI7QUFDckJDLFlBQU07QUFEZSxLQUF2QjtBQUdELEdBZkQ7QUFnQkQsQ0FsQkQ7O0FBb0JBO0FBQ0FpQixHQUFHbUIsSUFBSCxDQUFRO0FBQ047QUFDQUMsU0FBVUMsUUFGSjtBQUdOQyxVQUFVLElBSEo7QUFJTkMsU0FBVSxLQUpKO0FBS05DLFdBQVU7QUFMSixDQUFSOztBQVFBO0FBQ0FwQyxLQUFLcUMsSUFBTCxDQUFVLE9BQVYsRUFBbUIsWUFBVztBQUM1QnJDLE9BQUtELEtBQUwsQ0FBV2dDLElBQVgsR0FDQ3RELElBREQsQ0FDTSxNQUFNO0FBQ1Y7QUFDQTVDLFFBQUlxQixXQUFKLENBQWdCLElBQWhCO0FBQ0QsR0FKRDtBQUtELENBTkQiLCJmaWxlIjoiYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICogQ29weXJpZ2h0IDIwMTYgR29vZ2xlIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuY29uc3QgUEFTU1dPUkRfTE9HSU4gPSAncGFzc3dvcmQnO1xuY29uc3QgR09PR0xFX1NJR05JTiAgPSAnaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tJztcbmNvbnN0IEZBQ0VCT09LX0xPR0lOID0gJ2h0dHBzOi8vd3d3LmZhY2Vib29rLmNvbSc7XG5jb25zdCBSRUdJU1RFUiAgICAgICA9ICdyZWdpc3Rlcic7XG5jb25zdCBVTlJFR0lTVEVSICAgICA9ICd1bnJlZ2lzdGVyJztcbmNvbnN0IFNJR05PVVQgICAgICAgID0gJ3NpbmdvdXQnO1xuY29uc3QgREVGQVVMVF9JTUcgICAgPSAnL2ltYWdlcy9kZWZhdWx0X2ltZy5wbmcnO1xuXG4vKlxuICBBbHRob3VnaCB0aGlzIHNhbXBsZSBhcHAgaXMgdXNpbmcgUG9seW1lciwgbW9zdCBvZiB0aGUgaW50ZXJhY3Rpb25zIGFyZVxuICBoYW5kbGVkIHVzaW5nIHJlZ3VsYXIgQVBJcyBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBsZWFybiBhYm91dCBpdC5cbiAqL1xuY29uc3QgYXBwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FwcCcpO1xuLy8gYHNlbGVjdGVkYCBpcyB1c2VkIHRvIHNob3cgYSBwb3J0aW9uIG9mIG91ciBwYWdlXG5hcHAuc2VsZWN0ZWQgPSAwO1xuLy8gVXNlciBwcm9maWxlIGF1dG9tYXRpY2FsbHkgc2hvdyB1cCB3aGVuIGFuIG9iamVjdCBpcyBzZXQuXG5hcHAudXNlclByb2ZpbGUgPSBudWxsO1xuLy8gU2V0IGFuIGV2ZW50IGxpc3RlbmVyIHRvIHNob3cgYSB0b2FzdC4gKFBvbHltZXIpXG5hcHAubGlzdGVuZXJzID0ge1xuICAnc2hvdy10b2FzdCc6ICdzaG93VG9hc3QnXG59O1xuXG4vKipcbiAqIEF1dGhlbnRpY2F0aW9uIGZsb3cgd2l0aCBvdXIgb3duIHNlcnZlclxuICogQHBhcmFtICB7U3RyaW5nfSBwcm92aWRlciBDcmVkZW50aWFsIHR5cGUgc3RyaW5nLlxuICogQHBhcmFtICB7Rm9ybURhdGF9IGZvcm0gRm9ybURhdGEgdG8gUE9TVCB0byB0aGUgc2VydmVyXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyB3aGVuIHN1Y2Nlc3NmdWxseSBhdXRoZW50aWNhdGVkXG4gKi9cbmFwcC5fZmV0Y2ggPSBhc3luYyBmdW5jdGlvbihwcm92aWRlciwgYyA9IG5ldyBGb3JtRGF0YSgpKSB7XG4gIGxldCB1cmwgPSAnJztcbiAgc3dpdGNoIChwcm92aWRlcikge1xuICAgIGNhc2UgRkFDRUJPT0tfTE9HSU46XG4gICAgICB1cmwgPSAnL2F1dGgvZmFjZWJvb2snO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBHT09HTEVfU0lHTklOOlxuICAgICAgdXJsID0gJy9hdXRoL2dvb2dsZSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFBBU1NXT1JEX0xPR0lOOlxuICAgICAgdXJsID0gJy9hdXRoL3Bhc3N3b3JkJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgUkVHSVNURVI6XG4gICAgICB1cmwgPSAnL3JlZ2lzdGVyJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVU5SRUdJU1RFUjpcbiAgICAgIHVybCA9ICcvdW5yZWdpc3Rlcic7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFNJR05PVVQ6XG4gICAgICB1cmwgPSAnL3NpZ25vdXQnO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAvLyBgY3JlZGVudGlhbHM6J2luY2x1ZGUnYCBpcyByZXF1aXJlZCB0byBpbmNsdWRlIGNvb2tpZXMgb24gYGZldGNoYFxuICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgaGVhZGVyczoge1xuICAgICAgLy8gYFgtUmVxdWVzdGVkLVdpdGhgIGhlYWRlciB0byBhdm9pZCBDU1JGIGF0dGFja3NcbiAgICAgICdYLVJlcXVlc3RlZC1XaXRoJzogJ1hNTEh0dHBSZXF1ZXN0J1xuICAgIH0sXG4gICAgYm9keTogY1xuICB9KTtcbiAgLy8gQ29udmVydCBKU09OIHN0cmluZyB0byBhbiBvYmplY3RcbiAgaWYgKHJlcy5zdGF0dXMgPT09IDIwMCkge1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuICB9XG59O1xuXG4vKipcbiAqIExldCB1c2VycyBzaWduLWluIHdpdGhvdXQgdHlwaW5nIGNyZWRlbnRpYWxzXG4gKiBAcGFyYW0gIHtCb29sZWFufSBzaWxlbnQgRGV0ZXJtaW5lcyBpZiBhY2NvdW50IGNob29zZXIgc2hvdWxkbid0IGJlXG4gKiBkaXNwbGF5ZWQuXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyBpZiBjcmVkZW50aWFsIGluZm8gaXMgYXZhaWxhYmxlLlxuICovXG5hcHAuX2F1dG9TaWduSW4gPSBhc3luYyBmdW5jdGlvbihzaWxlbnQpIHtcbiAgaWYgKHdpbmRvdy5QYXNzd29yZENyZWRlbnRpYWwgfHwgd2luZG93LkZlZGVyYXRlZENyZWRlbnRpYWwpIHtcbiAgICAvLyBBY3R1YWwgQ3JlZGVudGlhbCBNYW5hZ2VtZW50IEFQSSBjYWxsIHRvIGdldCBjcmVkZW50aWFsIG9iamVjdFxuICAgIGNvbnN0IGNyZWQgPSBhd2FpdCBuYXZpZ2F0b3IuY3JlZGVudGlhbHMuZ2V0KHtcbiAgICAgIHBhc3N3b3JkOiB0cnVlLFxuICAgICAgZmVkZXJhdGVkOiB7XG4gICAgICAgIHByb3ZpZGVyczogW0dPT0dMRV9TSUdOSU4sIEZBQ0VCT09LX0xPR0lOXVxuICAgICAgfSxcbiAgICAgIG1lZGlhdGlvbjogc2lsZW50ID8gJ3NpbGVudCcgOiAnb3B0aW9uYWwnXG4gICAgfSk7XG4gICAgLy8gSWYgY3JlZGVudGlhbCBvYmplY3QgaXMgYXZhaWxhYmxlXG4gICAgaWYgKGNyZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdhdXRvIHNpZ24taW4gcGVyZm9ybWVkJyk7XG5cbiAgICAgIGxldCBwcm9taXNlO1xuICAgICAgc3dpdGNoIChjcmVkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAncGFzc3dvcmQnOlxuICAgICAgICAgIC8vIElmIGBwYXNzd29yZGAgcHJvcCBkb2Vzbid0IGV4aXN0LCB0aGlzIGlzIENocm9tZSA8IDYwXG4gICAgICAgICAgaWYgKGNyZWQucGFzc3dvcmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY3JlZC5pZE5hbWUgPSAnZW1haWwnO1xuICAgICAgICAgICAgcHJvbWlzZSA9IGFwcC5fZmV0Y2goUEFTU1dPUkRfTE9HSU4sIGNyZWQpO1xuXG4gICAgICAgICAgLy8gT3RoZXJ3aXNlLCB0aGlzIGlzIENocm9tZSA9PiA2MFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDaGFuZ2UgZm9ybSBgaWRgIG5hbWUgdG8gYGVtYWlsYFxuICAgICAgICAgICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAgICAgZm9ybS5hcHBlbmQoJ2VtYWlsJywgY3JlZC5pZCk7XG4gICAgICAgICAgICBmb3JtLmFwcGVuZCgncGFzc3dvcmQnLCBjcmVkLnBhc3N3b3JkKTtcbiAgICAgICAgICAgIHByb21pc2UgPSBhcHAuX2ZldGNoKFBBU1NXT1JEX0xPR0lOLCBmb3JtKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2ZlZGVyYXRlZCc6XG4gICAgICAgICAgc3dpdGNoIChjcmVkLnByb3ZpZGVyKSB7XG4gICAgICAgICAgICBjYXNlIEdPT0dMRV9TSUdOSU46XG4gICAgICAgICAgICAgIC8vIFJldHVybiBQcm9taXNlIGZyb20gYGdTaWduSW5gXG4gICAgICAgICAgICAgIHByb21pc2UgPSBhcHAuZ1NpZ25JbihjcmVkLmlkKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEZBQ0VCT09LX0xPR0lOOlxuICAgICAgICAgICAgICAvLyBSZXR1cm4gUHJvbWlzZSBmcm9tIGBmYlNpZ25JbmBcbiAgICAgICAgICAgICAgcHJvbWlzZSA9IGFwcC5mYlNpZ25JbigpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAocHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGFwcC5zaWduZWRJbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdhdXRvIHNpZ24taW4gbm90IHBlcmZvcm1lZCcpO1xuXG4gICAgICAvLyBSZXNvbHZlIGlmIGNyZWRlbnRpYWwgb2JqZWN0IGlzIG5vdCBhdmFpbGFibGVcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gUmVzb2x2ZSBpZiBDcmVkZW50aWFsIE1hbmFnZW1lbnQgQVBJIGlzIG5vdCBhdmFpbGFibGVcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn07XG5cbi8qKlxuICogV2hlbiBwYXNzd29yZCBzaWduLWluIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuYXBwLm9uUHdTaWduSW4gPSBmdW5jdGlvbihlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKTtcblxuICBjb25zdCBzaWduaW5Gb3JtID0gZS50YXJnZXQ7XG5cbiAgLy8gUG9seW1lciBgaXJvbi1mb3JtYCBmZWF0dXJlIHRvIHZhbGlkYXRlIHRoZSBmb3JtXG4gIGlmICghc2lnbmluRm9ybS52YWxpZGF0ZSgpKSByZXR1cm47XG5cbiAgY29uc3Qgc2lnbmluRm9ybURhdGEgPSBuZXcgRm9ybURhdGEoc2lnbmluRm9ybSk7XG5cbiAgLy8gU3RvcmUgdGhlIGV4YWN0IGNyZWRlbnRpYWxzIHNlbnQgdG8gdGhlIHNlcnZlclxuICBjb25zdCBlbWFpbCA9IHNpZ25pbkZvcm1EYXRhLmdldCgnZW1haWwnKTtcbiAgY29uc3QgcGFzc3dvcmQgPSBzaWduaW5Gb3JtRGF0YS5nZXQoJ3Bhc3N3b3JkJyk7XG5cbiAgLy8gU2lnbi1JbiB3aXRoIG91ciBvd24gc2VydmVyXG4gIGFwcC5fZmV0Y2goUEFTU1dPUkRfTE9HSU4sIHNpZ25pbkZvcm1EYXRhKVxuICAudGhlbihhcHAuc2lnbmVkSW4pXG4gIC50aGVuKHByb2ZpbGUgPT4ge1xuICAgIGFwcC4kLmRpYWxvZy5jbG9zZSgpO1xuXG4gICAgaWYgKHdpbmRvdy5QYXNzd29yZENyZWRlbnRpYWwpIHtcbiAgICAgIC8vIENvbnN0cnVjdCBgRm9ybURhdGFgIG9iamVjdCBmcm9tIGFjdHVhbCBgZm9ybWBcbiAgICAgIGNvbnN0IGNyZWQgPSBuZXcgUGFzc3dvcmRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6IGVtYWlsLFxuICAgICAgICBwYXNzd29yZDogcGFzc3dvcmQsXG4gICAgICAgIG5hbWU6IHByb2ZpbGUubmFtZVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFN0b3JlIGNyZWRlbnRpYWwgaW5mb3JtYXRpb24gYmVmb3JlIHBvc3RpbmdcbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnWW91IGFyZSBzaWduZWQgaW4nXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICAvLyBQb2x5bWVyIGV2ZW50IHRvIG5vdGljZSB1c2VyIHRoYXQgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcuXG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnQXV0aGVudGljYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogV2hlbiBnb29nbGUgc2lnbi1pbiBidXR0b24gaXMgcHJlc3NlZC5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vbkdTaWduSW4gPSBmdW5jdGlvbigpIHtcbiAgYXBwLmdTaWduSW4oKVxuICAudGhlbihhcHAuc2lnbmVkSW4pXG4gIC50aGVuKHByb2ZpbGUgPT4ge1xuICAgIGFwcC4kLmRpYWxvZy5jbG9zZSgpO1xuXG4gICAgaWYgKHdpbmRvdy5GZWRlcmF0ZWRDcmVkZW50aWFsKSB7XG4gICAgICAvLyBDcmVhdGUgYENyZWRlbnRpYWxgIG9iamVjdCBmb3IgZmVkZXJhdGlvblxuICAgICAgY29uc3QgY3JlZCA9IG5ldyBGZWRlcmF0ZWRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICAgIG5hbWU6ICAgICBwcm9maWxlLm5hbWUsXG4gICAgICAgIGljb25VUkw6ICBwcm9maWxlLmltYWdlVXJsIHx8IERFRkFVTFRfSU1HLFxuICAgICAgICBwcm92aWRlcjogR09PR0xFX1NJR05JTlxuICAgICAgfSk7XG4gICAgICAvLyBTdG9yZSBjcmVkZW50aWFsIGluZm9ybWF0aW9uIGFmdGVyIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb25cbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnWW91IGFyZSBzaWduZWQgaW4nXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICAvLyBQb2x5bWVyIGV2ZW50IHRvIG5vdGljZSB1c2VyIHRoYXQgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcuXG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnQXV0aGVudGljYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogTGV0IHVzZXIgc2lnbi1pbiB1c2luZyBHb29nbGUgU2lnbi1pblxuICogQHBhcmFtICB7U3RyaW5nfSBpZCBQcmVmZXJyZWQgR21haWwgYWRkcmVzcyBmb3IgdXNlciB0byBzaWduLWluXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXR1cm5zIHJlc3VsdCBvZiBhdXRoRmxvd1xuICovXG5hcHAuZ1NpZ25JbiA9IGZ1bmN0aW9uKGlkKSB7XG4gIC8vIFJldHVybiBQcm9taXNlIGFmdGVyIEZhY2Vib29rIExvZ2luIGRhbmNlLlxuICByZXR1cm4gKCgpID0+IHtcbiAgICBjb25zdCBhdXRoMiA9IGdhcGkuYXV0aDIuZ2V0QXV0aEluc3RhbmNlKCk7XG4gICAgaWYgKGF1dGgyLmlzU2lnbmVkSW4uZ2V0KCkpIHtcbiAgICAgIC8vIENoZWNrIGlmIGN1cnJlbnRseSBzaWduZWQgaW4gdXNlciBpcyB0aGUgc2FtZSBhcyBpbnRlbmRlZC5cbiAgICAgIGNvbnN0IGdvb2dsZVVzZXIgPSBhdXRoMi5jdXJyZW50VXNlci5nZXQoKTtcbiAgICAgIGlmIChnb29nbGVVc2VyLmdldEJhc2ljUHJvZmlsZSgpLmdldEVtYWlsKCkgPT09IGlkKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZ29vZ2xlVXNlcik7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIHRoZSB1c2VyIGlzIG5vdCBzaWduZWQgaW4gd2l0aCBleHBlY3RlZCBhY2NvdW50LCBsZXQgc2lnbiBpbi5cbiAgICByZXR1cm4gYXV0aDIuc2lnbkluKHtcbiAgICAgIC8vIFNldCBgbG9naW5faGludGAgdG8gc3BlY2lmeSBhbiBpbnRlbmRlZCB1c2VyIGFjY291bnQsXG4gICAgICAvLyBvdGhlcndpc2UgdXNlciBzZWxlY3Rpb24gZGlhbG9nIHdpbGwgcG9wdXAuXG4gICAgICBsb2dpbl9oaW50OiBpZCB8fCAnJ1xuICAgIH0pO1xuICB9KSgpLnRoZW4oZ29vZ2xlVXNlciA9PiB7XG4gICAgLy8gTm93IHVzZXIgaXMgc3VjY2Vzc2Z1bGx5IGF1dGhlbnRpY2F0ZWQgd2l0aCBHb29nbGUuXG4gICAgLy8gU2VuZCBJRCBUb2tlbiB0byB0aGUgc2VydmVyIHRvIGF1dGhlbnRpY2F0ZSB3aXRoIG91ciBzZXJ2ZXIuXG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm0uYXBwZW5kKCdpZF90b2tlbicsIGdvb2dsZVVzZXIuZ2V0QXV0aFJlc3BvbnNlKCkuaWRfdG9rZW4pO1xuICAgIHJldHVybiBhcHAuX2ZldGNoKEdPT0dMRV9TSUdOSU4sIGZvcm0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogV2hlbiBmYWNlYm9vayBsb2dpbiBidXR0b24gaXMgcHJlc3NlZC5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vbkZiU2lnbkluID0gZnVuY3Rpb24oKSB7XG4gIGFwcC5mYlNpZ25JbigpXG4gIC50aGVuKGFwcC5zaWduZWRJbilcbiAgLnRoZW4ocHJvZmlsZSA9PiB7XG4gICAgYXBwLiQuZGlhbG9nLmNsb3NlKCk7XG5cbiAgICBpZiAod2luZG93LkZlZGVyYXRlZENyZWRlbnRpYWwpIHtcbiAgICAgIC8vIENyZWF0ZSBgQ3JlZGVudGlhbGAgb2JqZWN0IGZvciBmZWRlcmF0aW9uXG4gICAgICBjb25zdCBjcmVkID0gbmV3IEZlZGVyYXRlZENyZWRlbnRpYWwoe1xuICAgICAgICBpZDogICAgICAgcHJvZmlsZS5lbWFpbCxcbiAgICAgICAgbmFtZTogICAgIHByb2ZpbGUubmFtZSxcbiAgICAgICAgaWNvblVSTDogIHByb2ZpbGUuaW1hZ2VVcmwgfHwgREVGQVVMVF9JTUcsXG4gICAgICAgIHByb3ZpZGVyOiBGQUNFQk9PS19MT0dJTlxuICAgICAgfSk7XG4gICAgICAvLyBTdG9yZSBjcmVkZW50aWFsIGluZm9ybWF0aW9uIGFmdGVyIHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb25cbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnWW91IGFyZSBzaWduZWQgaW4nXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICAvLyBQb2x5bWVyIGV2ZW50IHRvIG5vdGljZSB1c2VyIHRoYXQgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcuXG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnQXV0aGVudGljYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogTGV0IHVzZXIgc2lnbi1pbiB1c2luZyBGYWNlYm9vayBMb2dpblxuICogQHJldHVybiB7UHJvbWlzZX0gUmV0dXJucyByZXN1bHQgb2YgYXV0aEZsb3dcbiAqL1xuYXBwLmZiU2lnbkluID0gZnVuY3Rpb24oKSB7XG4gIC8vIFJldHVybiBQcm9taXNlIGFmdGVyIEZhY2Vib29rIExvZ2luIGRhbmNlLlxuICByZXR1cm4gKCgpID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgRkIuZ2V0TG9naW5TdGF0dXMoZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgIGlmIChyZXMuc3RhdHVzID09ICdjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIEZCLmxvZ2luKHJlc29sdmUsIHtzY29wZTogJ2VtYWlsJ30pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSkoKS50aGVuKHJlcyA9PiB7XG4gICAgLy8gT24gc3VjY2Vzc2Z1bCBhdXRoZW50aWNhdGlvbiB3aXRoIEZhY2Vib29rXG4gICAgaWYgKHJlcy5zdGF0dXMgPT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIC8vIEZvciBGYWNlYm9vaywgd2UgdXNlIHRoZSBBY2Nlc3MgVG9rZW4gdG8gYXV0aGVudGljYXRlLlxuICAgICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgZm9ybS5hcHBlbmQoJ2FjY2Vzc190b2tlbicsIHJlcy5hdXRoUmVzcG9uc2UuYWNjZXNzVG9rZW4pO1xuICAgICAgcmV0dXJuIGFwcC5fZmV0Y2goRkFDRUJPT0tfTE9HSU4sIGZvcm0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXaGVuIGF1dGhlbnRpY2F0aW9uIHdhcyByZWplY3RlZCBieSBGYWNlYm9va1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gICAgfVxuICB9KTtcbn07XG5cbi8qKlxuICogSW52b2tlZCB3aGVuICdSZWdpc3RlcicgYnV0dG9uIGlzIHByZXNzZWQsIHBlcmZvcm1zIHJlZ2lzdHJhdGlvbiBmbG93XG4gKiBhbmQgbGV0IHVzZXIgc2lnbi1pbi5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmFwcC5vblJlZ2lzdGVyID0gZnVuY3Rpb24oZSkge1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgY29uc3QgcmVnRm9ybSA9IGUudGFyZ2V0O1xuXG4gIC8vIFBvbHltZXIgYGlyb24tZm9ybWAgZmVhdHVyZSB0byB2YWxpZGF0ZSB0aGUgZm9ybVxuICBpZiAoIXJlZ0Zvcm0udmFsaWRhdGUoKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHJlZ0Zvcm1EYXRhID0gbmV3IEZvcm1EYXRhKHJlZ0Zvcm0pO1xuXG4gIC8vIFN0b3JlIHRoZSBleGFjdCBjcmVkZW50aWFscyBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAgY29uc3QgZW1haWwgPSByZWdGb3JtRGF0YS5nZXQoJ2VtYWlsJyk7XG4gIGNvbnN0IHBhc3N3b3JkID0gcmVnRm9ybURhdGEuZ2V0KCdwYXNzd29yZCcpO1xuXG4gIGFwcC5fZmV0Y2goUkVHSVNURVIsIHJlZ0Zvcm1EYXRhKVxuICAudGhlbihhcHAuc2lnbmVkSW4pXG4gIC50aGVuKHByb2ZpbGUgPT4ge1xuICAgIGFwcC5maXJlKCdzaG93LXRvYXN0Jywge1xuICAgICAgdGV4dDogJ1RoYW5rcyBmb3Igc2lnbmluZyB1cCEnXG4gICAgfSk7XG5cbiAgICBpZiAod2luZG93LlBhc3N3b3JkQ3JlZGVudGlhbCkge1xuICAgICAgLy8gQ3JlYXRlIHBhc3N3b3JkIGNyZWRlbnRpYWxcbiAgICAgIGNvbnN0IGNyZWQgPSBuZXcgUGFzc3dvcmRDcmVkZW50aWFsKHtcbiAgICAgICAgaWQ6IGVtYWlsLFxuICAgICAgICBwYXNzd29yZDogcGFzc3dvcmQsXG4gICAgICAgIG5hbWU6IHByb2ZpbGUubmFtZSxcbiAgICAgICAgaWNvblVSTDogcHJvZmlsZS5pbWFnZVVybFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFN0b3JlIHVzZXIgaW5mb3JtYXRpb24gYXMgdGhpcyBpcyByZWdpc3RyYXRpb24gdXNpbmcgaWQvcGFzc3dvcmRcbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5zdG9yZShjcmVkKTtcbiAgICB9XG4gIH0sICgpID0+IHtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdSZWdpc3RyYXRpb24gZmFpbGVkJ1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogSW52b2tlZCB3aGVuICdVbnJlZ2lzdGVyJyBidXR0b24gaXMgcHJlc3NlZCwgdW5yZWdpc3RlcnMgdXNlci5cbiAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxuICovXG5hcHAub25VbnJlZ2lzdGVyID0gZnVuY3Rpb24oKSB7XG4gIC8vIFBPU1QgYGlkYCB0byBgL3VucmVnaXN0ZXJgIHRvIHVucmVnaXN0ZXIgdGhlIHVzZXJcbiAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICBmb3JtLmFwcGVuZCgnaWQnLCBhcHAudXNlclByb2ZpbGUuaWQpO1xuXG4gIGFwcC5fZmV0Y2goVU5SRUdJU1RFUiwgZm9ybSlcbiAgLnRoZW4oKCkgPT4ge1xuICAgIGlmIChuYXZpZ2F0b3IuY3JlZGVudGlhbHMgJiYgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnByZXZlbnRTaWxlbnRBY2Nlc3MpIHtcbiAgICAgIC8vIFR1cm4gb24gdGhlIG1lZGlhdGlvbiBtb2RlIHNvIGF1dG8gc2lnbi1pbiB3b24ndCBoYXBwZW5cbiAgICAgIC8vIHVudGlsIG5leHQgdGltZSB1c2VyIGludGVuZGVkIHRvIGRvIHNvLlxuICAgICAgbmF2aWdhdG9yLmNyZWRlbnRpYWxzLnByZXZlbnRTaWxlbnRBY2Nlc3MoKTtcbiAgICB9XG4gICAgYXBwLnVzZXJQcm9maWxlID0gbnVsbDtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6IFwiWW91J3JlIHVucmVnaXN0ZXJlZC5cIlxuICAgIH0pO1xuICAgIGFwcC5zZWxlY3RlZCA9IDA7XG4gIH0sIGUgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiAnRmFpbGVkIHRvIHVucmVnaXN0ZXInXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gJ1NpZ24tb3V0JyBidXR0b24gaXMgcHJlc3NlZCwgcGVyZm9ybXMgc2lnbi1vdXQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAuc2lnbk91dCA9IGZ1bmN0aW9uKCkge1xuICBhcHAuX2ZldGNoKFNJR05PVVQpXG4gIC50aGVuKCgpID0+IHtcbiAgICBpZiAobmF2aWdhdG9yLmNyZWRlbnRpYWxzICYmIG5hdmlnYXRvci5jcmVkZW50aWFscy5wcmV2ZW50U2lsZW50QWNjZXNzKSB7XG4gICAgICAvLyBUdXJuIG9uIHRoZSBtZWRpYXRpb24gbW9kZSBzbyBhdXRvIHNpZ24taW4gd29uJ3QgaGFwcGVuXG4gICAgICAvLyB1bnRpbCBuZXh0IHRpbWUgdXNlciBpbnRlbmRlZCB0byBkbyBzby5cbiAgICAgIG5hdmlnYXRvci5jcmVkZW50aWFscy5wcmV2ZW50U2lsZW50QWNjZXNzKCk7XG4gICAgfVxuICAgIGFwcC51c2VyUHJvZmlsZSA9IG51bGw7XG4gICAgYXBwLmZpcmUoJ3Nob3ctdG9hc3QnLCB7XG4gICAgICB0ZXh0OiBcIllvdSdyZSBzaWduZWQgb3V0LlwiXG4gICAgfSk7XG4gIH0sICgpID0+IHtcbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdGYWlsZWQgdG8gc2lnbiBvdXQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBVc2VyIGlzIHNpZ25lZCBpbi4gRmlsbCB1c2VyIGluZm8uXG4gKiBAcGFyYW0gIHtPYmplY3R9IHByb2ZpbGUgUHJvZmlsZSBpbmZvcm1hdGlvbiBvYmplY3RcbiAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gYXV0aGVudGljYXRpb24gc3VjY2VlZGVkLlxuICovXG5hcHAuc2lnbmVkSW4gPSBmdW5jdGlvbihwcm9maWxlKSB7XG4gIGlmIChwcm9maWxlICYmIHByb2ZpbGUubmFtZSAmJiBwcm9maWxlLmVtYWlsKSB7XG4gICAgYXBwLnVzZXJQcm9maWxlID0ge1xuICAgICAgaWQ6ICAgICAgIHByb2ZpbGUuaWQsXG4gICAgICBuYW1lOiAgICAgcHJvZmlsZS5uYW1lLFxuICAgICAgZW1haWw6ICAgIHByb2ZpbGUuZW1haWwsXG4gICAgICBpbWFnZVVybDogcHJvZmlsZS5pbWFnZVVybCB8fCBERUZBVUxUX0lNR1xuICAgIH07XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShwcm9maWxlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBQb2x5bWVyIGV2ZW50IGhhbmRsZXIgdG8gc2hvdyBhIHRvYXN0LlxuICogQHBhcmFtICB7RXZlbnR9IGUgUG9seW1lciBjdXN0b20gZXZlbnQgb2JqZWN0XG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAuc2hvd1RvYXN0ID0gZnVuY3Rpb24oZSkge1xuICB0aGlzLiQudG9hc3QudGV4dCA9IGUuZGV0YWlsLnRleHQ7XG4gIHRoaXMuJC50b2FzdC5zaG93KCk7XG59O1xuXG4vKipcbiAqIEludm9rZWQgd2hlbiAnU2lnbi1JbicgYnV0dG9uIGlzIHByZXNzZWQsIHBlcmZvcm0gYXV0by1zaWduLWluIGFuZFxuICogb3BlbiBkaWFsb2cgaWYgaXQgZmFpbHMuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5hcHAub3BlbkRpYWxvZyA9IGZ1bmN0aW9uKCkge1xuICAvLyBUcnkgYXV0byBzaWduLWluIGJlZm9yZSBvcGVuaW5nIHRoZSBkaWFsb2dcbiAgYXBwLl9hdXRvU2lnbkluKGZhbHNlKVxuICAudGhlbihwcm9maWxlID0+IHtcbiAgICAvLyBXaGVuIGF1dG8gc2lnbi1pbiBkaWRuJ3QgcmVzb2x2ZSB3aXRoIGEgcHJvZmlsZVxuICAgIC8vIGl0J3MgZmFpbGVkIHRvIGdldCBjcmVkZW50aWFsIGluZm9ybWF0aW9uLlxuICAgIC8vIE9wZW4gdGhlIGZvcm0gc28gdGhlIHVzZXIgY2FuIGVudGVyIGlkL3Bhc3N3b3JkXG4gICAgLy8gb3Igc2VsZWN0IGZlZGVyYXRlZCBsb2dpbiBtYW51YWxseVxuICAgIGlmICghcHJvZmlsZSkge1xuICAgICAgYXBwLiQuZGlhbG9nLm9wZW4oKTtcbiAgICB9XG4gIH0sICgpID0+IHtcbiAgICBhcHAuJC5kaWFsb2cub3BlbigpO1xuICAgIC8vIFdoZW4gcmVqZWN0ZWQsIGF1dGhlbnRpY2F0aW9uIHdhcyBwZXJmb3JtZWQgYnV0IGZhaWxlZC5cbiAgICBhcHAuZmlyZSgnc2hvdy10b2FzdCcsIHtcbiAgICAgIHRleHQ6ICdBdXRoZW50aWNhdGlvbiBmYWlsZWQnXG4gICAgfSk7XG4gIH0pO1xufTtcblxuLy8gSW5pdGlhbGlzZSBGYWNlYm9vayBMb2dpblxuRkIuaW5pdCh7XG4gIC8vIFJlcGxhY2UgdGhpcyB3aXRoIHlvdXIgb3duIEFwcCBJRFxuICBhcHBJZDogICAgRkJfQVBQSUQsXG4gIGNvb2tpZTogICB0cnVlLFxuICB4ZmJtbDogICAgZmFsc2UsXG4gIHZlcnNpb246ICAndjIuNSdcbn0pO1xuXG4vLyBJbml0aWFsaXNlIEdvb2dsZSBTaWduLUluXG5nYXBpLmxvYWQoJ2F1dGgyJywgZnVuY3Rpb24oKSB7XG4gIGdhcGkuYXV0aDIuaW5pdCgpXG4gIC50aGVuKCgpID0+IHtcbiAgICAvLyBUcnkgYXV0byBzaWduLWluIHBlcmZvcm1hbmNlIGFmdGVyIGluaXRpYWxpemF0aW9uXG4gICAgYXBwLl9hdXRvU2lnbkluKHRydWUpO1xuICB9KTtcbn0pO1xuIl19
