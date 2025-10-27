const express = require('express')
const { engine } = require('express-handlebars')
const Handlebars = require('handlebars')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const app = express()
const port = 80

// Redirecciones
const appRoutes = {
    home: '/',

    // ACCOUNT
      profile: '/account/profile',
      transactions: '/account/transactions',
      register: '/account/register',
      login: '/account/login',
      register: '/account/register',
      logout: '/account/logout',

    // INFO
      rouletteRules: '/info/roulette-rules',
      aboutUs: '/info/about-us',

    // NOSE
      roulette: '/roulette',
      bienvenida: '/bienvenida'
}

// Configurar Handlebars con layout por defecto y helper
app.engine('handlebars', engine({
  defaultLayout: 'main',
  helpers: {
    url: (route) => {
      return appRoutes[route]
    },

    navLink: function(currentTitle, linkTitle, routeName) {
      const url = appRoutes[routeName]
      let html

      if (currentTitle === linkTitle) {
          html = `<li class="nav-actual">${linkTitle}</li>`
      } else {
          html = `<li><a href="${url}">${linkTitle}</a></li>`
      }

      return new Handlebars.SafeString(html)
    }
  }
}))
app.set('view engine', 'handlebars')
app.set('views', './views')

// Leer datos de formularios
app.use(bodyParser.urlencoded({ extended: true }))

// Middleware que habilita el manejo de cookies
app.use(cookieParser())

// Archivos estaticos
app.use(express.static('public'))

// Base de datos
mongoose.connect('mongodb+srv://admin:admin321@cluster0.ilgvl5k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Conexión exitosa a MongoDB Atlas')
})
.catch(err => {
  console.error('Error conectando a MongoDB', err)
})

const UsuarioSchema = new mongoose.Schema({
  name: String,
  surname: String,
  user: String,
  birth: Date,
  rut: {
    type: String,
    required: true,
    unique: true
  },
  mail: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  }
})

const Usuario = mongoose.model('Usuario', UsuarioSchema)

// ==============================
//              HOME
// ==============================
app.get('/', (req, res) => {
  res.render('home', {
    pageTitle: 'Inicio'
  })
})

// ==============================
//            ACCOUNT
// ==============================
app.get('/account', (req, res) => {
  res.redirect(appRoutes.profile)
})

          // =========
          //  PROFILE
          // =========
app.get(appRoutes.profile, async (req, res) => {
  const usuario_id = req.cookies.usuario_id

  if (!usuario_id) {
    return res.redirect(appRoutes.login)
  }

  try {
    const usuario = await Usuario.findById(usuario_id).lean()

    if (!usuario) {
      res.clearCookie('usuario_id')
      res.clearCookie('username')
      return res.redirect(appRoutes.login)
    }

    res.render('profile', {
      pageTitle: 'Perfil',
      usuario: usuario
    })

  } catch (err) {
    console.error('Error al buscar perfil de usuario:', err)
    res.send('Error al cargar el perfil.')
  }
})

          // ==============
          //  TRANSACTIONS
          // ==============
app.get(appRoutes.transactions, (req, res) => {
  const username = req.cookies.username
  if (!username) return res.redirect(appRoutes.login)

  res.render('transactions', {
    pageTitle: 'Transacciones'
  })
})

          // ==========
          //  REGISTER
          // ==========
app.get('/register', (req, res) => {
  res.redirect(appRoutes.register)
})

app.get(appRoutes.register, (req, res) => {
  res.render('register', {
    layout: 'clean',
    pageTitle: 'Registro'
  })
})

app.post(appRoutes.register, async (req, res) => {
  const { name, surname, user, birth, rut, mail, password, 'password-confirm': passwordConfirm } = req.body

  if (password !== passwordConfirm) {
    return res.send('Las contraseñas no coinciden.')
  }

  try {
    const existingUser = await Usuario.findOne({ $or: [{ rut }, { mail }] })
    if (existingUser) {
      return res.send('El RUT o el correo ya están registrados.')
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const nuevoUsuario = new Usuario({
      name,
      surname,
      user,
      birth,
      rut,
      mail,
      password: hashedPassword
    })

    await nuevoUsuario.save()
    res.redirect(appRoute.login)

  } catch (err) {
    console.error('Error al registrar usuario:', err)
    res.send('Error interno del servidor')
  }
})

          // =======
          //  LOGIN
          // =======
app.get('/login', (req, res) => {
  res.redirect(appRoutes.login)
})

app.get(appRoutes.login, (req, res) => {
  res.render('login', {
    layout: 'clean',
    pageTitle: 'Inicio de sesión'
  })
})

app.post(appRoutes.login, async (req, res) => {
  const { rut, password } = req.body

  try {
    const usuario = await Usuario.findOne({ rut })

    if (!usuario) {
      return res.send('Credenciales inválidas. <a href="/login">Intentar de nuevo</a>')
    }

    const isMatch = await bcrypt.compare(password, usuario.password)

    if (!isMatch) {
      return res.send('Credenciales inválidas. <a href="/login">Intentar de nuevo</a>')
    }

    res.cookie('usuario_id', usuario._id.toString(), { httpOnly: true })

    res.cookie('username', usuario.user)

    res.redirect(appRoutes.bienvenida)

  } catch (err) {
    console.error('Error al iniciar sesión:', err)
    res.send('Error interno del servidor')
  }
})

          // ========
          //  LOGOUT
          // ========
app.get(appRoutes.logout, (req, res) => {
  res.clearCookie('usuario_id')
  res.clearCookie('username')
  res.redirect(appRoute.login)
})

// ==============================
//              INFO
// ==============================
app.get('/register', (req, res) => {
  res.redirect(appRoutes.aboutUs)
})

          // ==========
          //  ABOUT US
          // ==========
app.get(appRoutes.aboutUs, (req, res) => {
  res.render('app', {
    pageTitle: 'Sobre Nosotros'
  })
})
          // ================
          //  ROULETTE-RULES
          // ================
app.get(appRoutes.rouletteRules, (req, res) => {
  res.render('roulette-rules', {
    pageTitle: 'Reglas de la Ruleta'
  })
})

// ==============================
//              NOSE
// ==============================

          // ==========
          //  ROULETTE
          // ==========
app.get(appRoutes.roulette, (req, res) => {
  res.render('roulette', {
    pageTitle: 'Ruleta'
  })
})
          // ============
          //  BIENVENIDA
          // ============
app.get(appRoutes.bienvenida, (req, res) => {
  const username = req.cookies.username
  if (!username) return res.redirect(appRoutes.login)

  res.send(`<h2>Bienvenido, ${username}!</h2>`)
})

app.listen(port, () => {
  console.log(`Betanito vivo (http://localhost:${port})`)
})
