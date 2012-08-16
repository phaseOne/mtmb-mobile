
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , hash = require('./pass').hash;

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 8084);
  app.set('views', __dirname + '/dev/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(require('less-middleware')({ src: __dirname + '/dev', compress: true, dest: __dirname + '/public' }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var users = {
  siegelsc: { name: 'Scott Siegel' }
};

hash('foobar', function(err, salt, hash){
  if (err) throw err;
  // store the salt & hash in the "db"
  users.siegelsc.salt = salt;
  users.siegelsc.hash = hash;
});

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(new Error('cannot find user'));
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash(pass, user.salt, function(err, hash){
    if (err) return fn(err);
    if (hash == user.hash) return fn(null, user);
    fn(new Error('invalid password'));
  })
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/login', function(req, res){
  if (req.session.user) {
    req.session.success = 'Authenticated as ' + req.session.user.name
      + ' click to <a href="/logout">logout</a>. '
      + ' You may now access <a href="/restricted">/restricted</a>.';
  }
  res.render('login');
});

app.post('/login', function(req, res){
  authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation 
      req.session.regenerate(function(){
        // Store the user's primary key 
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "tj" and "foobar")';
      res.redirect('login');
    }
  });
});

app.get('/dashboard/logout', function(req, res) {
  req.session.destroy(function(){
    res.redirect('/login');
  });
});


/* Dashboard content */
app.locals.reqXHR = false;

var title = {
      base: 'MTMB Mobile Dashboard',
      separator: ' · '
    },
    suffix = title.separator + title.base,
    titles = {
      home:                 title.base,
      announcements:        'Announcements' + suffix,
      links:                'Links' + suffix,
      display_options:      'Display Options' + suffix,
      football:             'Football Games' + suffix,
      competitions:         'Competitions' + suffix,
      users:                'Users' + suffix
    };

function setActiveNavs(req, res, next) {
  res.locals.link = function(content, url, icon) {
    return req.url == url
      ? '<li class=active><a href="' + url + '">' + (icon ? '<i class="icon-white ' + icon + '"></i> ' : '') + content + '</a></li>'
      : '<li><a href="' + url + '">' + (icon ? '<i class="' + icon + '"></i> ' : '') + content + '</a></li>';
  };
  next();
};

function setTitle(req, res, next) {
  res.set('Title', titles[req.params.page.toLowerCase()]);
  res.locals.title = titles[req.params.page.toLowerCase()];
  next();
}

app.get('/dashboard', function(req, res) {
  res.redirect('/dashboard/home');
});

app.get('/dashboard/users/:id', setActiveNavs, function(req, res) {
  res.send(404, 'Sorry, this user doesn\'t exist');
});

app.get('/dashboard/:page', setTitle, setActiveNavs, function(req, res) {
  if (req.xhr) res.locals.reqXHR = true;
  
  if (req.params.page == 'index') res.redirect('/dashboard/home');
  
  res.render('dashboard/pages/' + req.params.page, { activeuser: { fullname: 'Scott Siegel', username: 'SiegelSc' } }, function(err, html) {
    if (err) {
      res.send(500, 'Sorry, this page has been stolen!');
      console.log(err);
    }
    else res.send(html);
  });
});


/* Main page */
app.get('/', function(req, res) {
  res.render('main/index', {
    title: 'title'
  });
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});