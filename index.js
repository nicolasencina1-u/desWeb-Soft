require('dotenv').config()

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
      logout: '/account/logout',

    // INFO
      rouletteRules: '/info/roulette-rules',
      aboutUs: '/info/about-us',

    // JUEGO
      roulette: '/roulette'
}

// Handlebars / Helpers
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
    },

    ifCond: function(a, b, options) {
      if (a === b) {
        return options.fn(this)
      }
      return options.inverse(this)
    },
      
    formatCurrency: (number) => {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(number)
    },
    
    formatDate: (date) => {
      return new Date(date).toLocaleString('es-CL')
    }
  }
}))
app.set('view engine', 'handlebars')
app.set('views', './views')

// Archivos estaticos
app.use(express.static('public'))
// Leer datos de formularios y JSON
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json())

// Middlewares
app.use(cookieParser())

app.use((req, res, next) => {
  if (req.cookies.usuario_id) {
    res.locals.isAuthenticated = true
  } else {
    res.locals.isAuthenticated = false
  }
  next()
})

const requireAuth = (req, res, next) => {
  if (!req.cookies.usuario_id) {
    return res.redirect(appRoutes.login)
  }
  res.locals.userId = req.cookies.usuario_id;
  next()
}

const redirectIfAuth = (req, res, next) => {
  if (req.cookies.usuario_id) {
    return res.redirect(appRoutes.profile);
  }
  next()
}

// Base de datos
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Conexión exitosa a MongoDB Atlas')
})
.catch(err => {
  console.error('Error conectando a MongoDB', err)
})

// USUARIO
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
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  }
})

const Usuario = mongoose.model('Usuario', UsuarioSchema)

// TRANSACCIONES
const TransaccionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'bet', 'win'], required: true },
    amount: { type: Number, required: true }, // +: win/deposit, -: bet/withdrawal
    betType: { type: String, default: null }, // ej: 'Rojo', 'Pleno 32', 'Par'
    gameResult: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
})

const Transaccion = mongoose.model('Transaccion', TransaccionSchema)
    
// PARTIDAS GUARDADAS
const PartidaRuletaSchema = new mongoose.Schema({
    winningNumber: { type: Number, required: true },
    color: { type: String, required: true }, // 'rojo', 'negro', 'verde'
    timestamp: { type: Date, default: Date.now }
})

const PartidaRuleta = mongoose.model('PartidaRuleta', PartidaRuletaSchema)

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
app.get(appRoutes.profile, requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(usuario_id).lean()

    if (!usuario) {
      return res.redirect(appRoutes.logout)
    }

    const transacciones = await Transaccion.find({ userId: res.locals.userId }).sort({ timestamp: -1 }).limit(5).lean()

    res.render('profile', {
      pageTitle: 'Perfil',
      usuario: usuario,
      transacciones = transacciones
    })

  } catch (err) {
    console.error('Error al buscar perfil de usuario:', err)
    res.send('Error al cargar el perfil.')
  }
})

          // ==============
          //  TRANSACTIONS
          // ==============
app.get(appRoutes.transactions, requireAuth, (req, res) => {
  try {
      const usuario = await Usuario.findById(res.locals.userId).lean()
      if (!usuario) {
          return res.redirect(appRoutes.logout)
      }

      const transacciones = await Transaccion.find({ userId: res.locals.userId }).sort({ timestamp: -1 }).limit(10).lean()
      
      res.render('transactions', {
        pageTitle: 'Transacciones',
        usuario: usuario,
        transacciones: transacciones
      })
  } catch (err) {
      console.error('Error al cargar transacciones:', err)
      res.send('Error al cargar la página de transacciones.')
  }
})

          // ==========
          //  REGISTER
          // ==========
app.get('/register', (req, res) => {
  res.redirect(appRoutes.register)
})

app.get(appRoutes.register, redirectIfAuth, (req, res) => {
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
      password: hashedPassword,
      balance: 50000
    })
    await nuevoUsuario.save()

    const transaccionInicial = new Transaccion({
        userId: nuevoUsuario._id,
        type: 'deposit',
        amount: 50000,
        betType: 'Bono de Bienvenida'
    });
    await transaccionInicial.save()
    
    res.redirect(appRoutes.login)

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

app.get(appRoutes.login, redirectIfAuth, (req, res) => {
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

    res.redirect(appRoutes.profile)

  } catch (err) {
    console.error('Error al iniciar sesión:', err)
    res.send('Error interno del servidor')
  }
})

          // ========
          //  LOGOUT
          // ========
app.get(appRoutes.logout, requireAuth, (req, res) => {
  res.clearCookie('usuario_id')
  res.clearCookie('username')
  res.redirect(appRoutes.login)
})

// ==============================
//              INFO
// ==============================

          // ==========
          //  ABOUT US
          // ==========
app.get(appRoutes.aboutUs, (req, res) => {
  res.render('aboutUs', {
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
//           ROULETTE
// ==============================
const ROULETTE_NUMBERS = {
    0: 'verde',
    1: 'rojo',    2: 'negro',   3: 'rojo',    4: 'negro',   5: 'rojo',    6: 'negro',
    7: 'rojo',    8: 'negro',   9: 'rojo',    10: 'negro',  11: 'negro',  12: 'rojo',
    13: 'negro',  14: 'rojo',   15: 'negro',  16: 'rojo',   17: 'negro',  18: 'rojo',
    19: 'rojo',   20: 'negro',  21: 'rojo',   22: 'negro',  23: 'rojo',   24: 'negro',
    25: 'rojo',   26: 'negro',  27: 'rojo',   28: 'negro',  29: 'negro',  30: 'rojo',
    31: 'negro',  32: 'rojo',   33: 'negro',  34: 'rojo',   35: 'negro',  36: 'rojo'
}

function getNumberData(number) {
    const color = ROULETTE_NUMBERS[number]
    return {
        number: number,
        color: color,
        isEven: number !== 0 && number % 2 === 0,
        isOdd: number !== 0 && number % 2 !== 0,
        isLow: number >= 1 && number <= 18,
        isHigh: number >= 19 && number <= 36,
        dozen: number >= 1 && number <= 12 ? 1 : (number >= 13 && number <= 24 ? 2 : (number >= 25 && number <= 36 ? 3 : null)),
        column: number !== 0 && number % 3 === 1 ? 1 : (number !== 0 && number % 3 === 2 ? 2 : (number !== 0 && number % 3 === 0 ? 3 : null))
    }
}

function getPayoutRate(betType) {
    if ( betType.startsWith('Pleno') ) return 35
    if ( betType.startsWith('Split') ) return 17
    if ( betType.startsWith('Calle') ) return 11
    if ( betType.startsWith('Cuadrada') ) return 8
    if ( betType.startsWith('Linea') ) return 5
    if ( betType === 'Docena 1' || betType === 'Docena 2' || betType === 'Docena 3' ) return 2
    if ( betType === 'Columna 1' || betType === 'Columna 2' || betType === 'Columna 3' ) return 2
    if ( ['Rojo', 'Negro', 'Par', 'Impar', 'Falta (1-18)', 'Pasa (19-36)'].includes(betType) ) return 1
    return 0
}

function checkWin(betType, numberData) {
    const { number, color, isEven, isOdd, isLow, isHigh, dozen, column } = numberData

    if (betType === `Pleno ${number}`) return true
    if (betType === 'Rojo' && color === 'rojo') return true
    if (betType === 'Negro' && color === 'negro') return true
    if (betType === 'Par' && isEven) return true
    if (betType === 'Impar' && isOdd) return true
    if (betType === 'Falta (1-18)' && isLow) return true
    if (betType === 'Pasa (19-36)' && isHigh) return true
    if (betType === 'Docena 1' && dozen === 1) return true
    if (betType === 'Docena 2' && dozen === 2) return true
    if (betType === 'Docena 3' && dozen === 3) return true
    if (betType === 'Columna 1' && column === 1) return true
    if (betType === 'Columna 2' && column === 2) return true
    if (betType === 'Columna 3' && column === 3) return true

    // Apuestas más complejas (split, calle, etc.) requerirían una lógica
    // de mapeo más avanzada, que no está implementada aquí por simplicidad.
    // Por ahora, solo manejamos apuestas simples.
    
    return false
}

app.get(appRoutes.roulette, requireAuth, async (req, res) => {
  try {
      const usuario = await Usuario.findById(res.locals.userId).lean()
      if (!usuario) {
          return res.redirect(appRoutes.logout)
      }

      const ultimosNumeros = await PartidaRuleta.find().sort({ timestamp: -1 }).limit(5).lean()

      const ultimasApuestas = await Transaccion.find({ userId: res.locals.userId, type: { $in: ['bet', 'win'] } }).sort({ timestamp: -1 }).limit(5).lean()

      res.render('roulette', {
          pageTitle: 'Ruleta',
          usuario: usuario,
          ultimosNumeros: ultimosNumeros,
          ultimasApuestas: ultimasApuestas,
          // Pasamos los datos como JSON para que JS los pueda usar
          gameData: JSON.stringify({
              balance: usuario.balance,
              lastNumbers: ultimosNumeros,
              lastBets: ultimasApuestas
          })
      })
  } catch (err) {
      console.error('Error al cargar la página de ruleta:', err)
      res.send('Error al cargar el juego.')
  }
})

app.post('/roulette/spin', requireAuth, async (req, res) => {
    const { bets } = req.body
    const userId = res.locals.userId

    if ( !bets || bets.length === 0 ) {
        return res.status(400).json({ error: 'No se han realizado apuestas.' })
    }

    try {
        const usuario = await Usuario.findById(userId);
        if ( !usuario ) {
            return res.status(404).json({ error: 'Usuario no encontrado.' })
        }

        // VALIDAR SALDO
        let totalBetAmount = 0;
        bets.forEach(bet => {
            totalBetAmount += bet.amount;
        })
        if (usuario.balance < totalBetAmount) {
            return res.status(400).json({ error: 'Saldo insuficiente.' })
        }

        // GUARDAR TRANSACCIONES
        usuario.balance -= totalBetAmount
        const betTransactions = bets.map(bet => ({
            userId: userId,
            type: 'bet',
            amount: -bet.amount,
            betType: bet.type,
        }))
        await Transaccion.insertMany(betTransactions)

        const winningNumber = Math.floor(Math.random() * 37)
        const numberData = getNumberData(winningNumber)
        
        // GUARDAR PARTIDA
        const nuevaPartida = new PartidaRuleta({
            winningNumber: winningNumber,
            color: numberData.color
        })
        await nuevaPartida.save()

        let totalWinnings = 0
        const winTransactions = []
        bets.forEach(bet => {
            const payoutRate = getPayoutRate(bet.type)
            const didWin = checkWin(bet.type, numberData)

            if (didWin) {
                const winnings = (bet.amount * payoutRate) + bet.amount
                totalWinnings += winnings
                winTransactions.push({
                    userId: userId,
                    type: 'win',
                    amount: winnings,
                    betType: bet.type,
                    gameResult: winningNumber
                })
            }
        })

        // 5. GUARDAR GANANCIAS
        if (totalWinnings > 0) {
            usuario.balance += totalWinnings;
            await Transaccion.insertMany(winTransactions)
        }
        await usuario.save()

        // 7. DEVOLVER RESULTADOS
        res.json({
            success: true,
            winningNumber: winningNumber,
            color: numberData.color,
            newBalance: usuario.balance,
            totalWinnings: totalWinnings,
            totalBet: totalBetAmount
        })

    } catch (err) {
        console.error('Error en /roulette/spin:', err)
        res.status(500).json({ error: 'Error interno del servidor.' })
    }
})

app.listen(port, () => {
  console.log(`Betanito vivo (http://localhost:${port})`)
})
