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
const GOOGLE_SIGNIN  = 'https://accounts.google.com';
const FACEBOOK_LOGIN = 'https://www.facebook.com';
const REGISTER       = 'register';
const UNREGISTER     = 'unregister';
const SIGNOUT        = 'singout';
const DEFAULT_IMG    = '/images/default_img.png';

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
app._fetch = async function(provider, c = new FormData()) {
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

  const res = await fetch(url, {
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
};

/**
 * Let users sign-in without typing credentials
 * @param  {Boolean} silent Determines if account chooser shouldn't be
 * displayed.
 * @return {Promise} Resolves if credential info is available.
 */
app._autoSignIn = async function(silent) {
  if (window.PasswordCredential || window.FederatedCredential) {
    // Actual Credential Management API call to get credential object
    const cred = await navigator.credentials.get({
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
};

/**
 * When password sign-in button is pressed.
 * @return {void}
 */
app.onPwSignIn = function(e) {
  e.preventDefault();

  const signinForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!signinForm.validate()) return;

  const signinFormData = new FormData(signinForm);

  // Store the exact credentials sent to the server
  const email = signinFormData.get('email');
  const password = signinFormData.get('password');

  // Sign-In with our own server
  app._fetch(PASSWORD_LOGIN, signinFormData)
  .then(app.signedIn)
  .then(profile => {
    app.$.dialog.close();

    if (window.PasswordCredential) {
      // Construct `FormData` object from actual `form`
      const cred = new PasswordCredential({id: email, password: password});
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
app.onGSignIn = function() {
  app.gSignIn()
  .then(app.signedIn)
  .then(profile => {
    app.$.dialog.close();

    if (window.FederatedCredential) {
      // Create `Credential` object for federation
      const cred = new FederatedCredential({
        id:       profile.email,
        name:     profile.name,
        iconURL:  profile.imageUrl || DEFAULT_IMG,
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
app.gSignIn = function(id) {
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
app.onFbSignIn = function() {
  app.fbSignIn()
  .then(app.signedIn)
  .then(profile => {
    app.$.dialog.close();

    if (window.FederatedCredential) {
      // Create `Credential` object for federation
      const cred = new FederatedCredential({
        id:       profile.email,
        name:     profile.name,
        iconURL:  profile.imageUrl || DEFAULT_IMG,
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
app.fbSignIn = function() {
  // Return Promise after Facebook Login dance.
  return (() => {
    return new Promise(function(resolve) {
      FB.getLoginStatus(function(res) {
        if (res.status == 'connected') {
          resolve(res);
        } else {
          FB.login(resolve, {scope: 'email'});
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
app.onRegister = function(e) {
  e.preventDefault();

  const regForm = e.target;

  // Polymer `iron-form` feature to validate the form
  if (!regForm.validate()) return;

  const regFormData = new FormData(regForm);

  // Store the exact credentials sent to the server
  const email = regFormData.get('email');
  const password = regFormData.get('password');

  app._fetch(REGISTER, regFormData)
  .then(app.signedIn)
  .then(profile => {
    app.fire('show-toast', {
      text: 'Thanks for signing up!'
    });

    if (window.PasswordCredential) {
      // Create password credential
      const cred = new PasswordCredential({id: email, password: password});
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
app.onUnregister = function() {
  // POST `id` to `/unregister` to unregister the user
  const form = new FormData();
  form.append('id', app.userProfile.id);

  app._fetch(UNREGISTER, form)
  .then(() => {
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
app.signOut = function() {
  app._fetch(SIGNOUT)
  .then(() => {
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
app.signedIn = function(profile) {
  if (profile && profile.name && profile.email) {
    app.userProfile = {
      id:       profile.id,
      name:     profile.name,
      email:    profile.email,
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
  .then(profile => {
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
  appId:    FB_APPID,
  cookie:   true,
  xfbml:    false,
  version:  'v2.5'
});

// Initialise Google Sign-In
gapi.load('auth2', function() {
  gapi.auth2.init()
  .then(() => {
    // Try auto sign-in performance after initialization
    app._autoSignIn(true);
  });
});
