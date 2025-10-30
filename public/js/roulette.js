document.addEventListener('DOMContentLoaded', () => {
  
  // --- REFERENCIAS AL DOM ---
  const wheel = document.getElementById('roulette-wheel')
  const ball = document.getElementById('ball')
  const gameStateDisplay = document.getElementById('game-state')
  const userBalanceDisplay = document.getElementById('user-balance')
  const totalBetDisplay = document.getElementById('total-bet-amount')
  const resultDisplay = document.getElementById('result-display').querySelector('span')
  
  const chipSelection = document.querySelector('.chip-selection')
  const betOptions = document.querySelectorAll('.bet-option')
  const btnSpin = document.getElementById('btn-spin')
  const btnClear = document.getElementById('btn-clear')

  const lastNumbersList = document.getElementById('last-numbers-list')
  const lastBetsList = document.getElementById('last-bets-list')

  // --- ESTADO DEL JUEGO ---
  let currentBalance = initialGameData.balance
  let currentChipValue = 1000
  let currentBets = {} // { 'Rojo': 1000, 'Pleno 5': 500 }
  let totalBetAmount = 0
  let isSpinning = false

  // --- MAPEO DE NÚMEROS DE LA RULETA ---
  // Orden de los números en el HTML/CSS
  const wheelNumbersOrder = [
    0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10, 
    23, 8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32
  ];
  
  const numberColors = {
    0: 'verde', 1: 'rojo', 2: 'negro', 3: 'rojo', 4: 'negro', 5: 'rojo', 6: 'negro', 7: 'rojo', 8: 'negro', 9: 'rojo', 10: 'negro',
    11: 'negro', 12: 'rojo', 13: 'negro', 14: 'rojo', 15: 'negro', 16: 'rojo', 17: 'negro', 18: 'rojo', 19: 'rojo',
    20: 'negro', 21: 'rojo', 22: 'negro', 23: 'rojo', 24: 'negro', 25: 'rojo', 26: 'negro', 27: 'rojo', 28: 'negro',
    29: 'negro', 30: 'rojo', 31: 'negro', 32: 'rojo', 33: 'negro', 34: 'rojo', 35: 'negro', 36: 'rojo'
  }

  // --- MANEJADORES DE EVENTOS ---

  // 1. Selección de Ficha
  chipSelection.addEventListener('click', (e) => {
    if ( e.target.classList.contains('chip') ) {
      // Quitar 'active' de la ficha anterior
      chipSelection.querySelector('.chip.active').classList.remove('active')
      // Añadir 'active' a la nueva
      e.target.classList.add('active')
      // Actualizar valor
      currentChipValue = parseInt(e.target.dataset.value)
    }
  })

  // 2. Limpiar Apuestas
  btnClear.addEventListener('click', () => {
    if ( isSpinning ) return
    currentBets = {}
    totalBetAmount = 0
    updateBetDisplays()
    // Eliminar fichas visuales
    document.querySelectorAll('.placed-chip').forEach(chip => chip.remove())
  })

  // 3. Realizar Apuesta (clic en el tablero)
  betOptions.forEach(option => {
    option.addEventListener('click', () => {
      if ( isSpinning ) return

      const betType = option.dataset.betType
      
      // Validar si el saldo permite esta apuesta
      if ( currentBalance < (totalBetAmount + currentChipValue) ) {
        showResultDisplay("Saldo insuficiente", 'error');
        return
      }

      // Añadir apuesta al estado
      if ( currentBets[betType] ) {
        currentBets[betType] += currentChipValue
      } else {
        currentBets[betType] = currentChipValue
      }
      totalBetAmount += currentChipValue

      // Actualizar UI
      updateBetDisplays()
      visualizeChip(option, currentChipValue)
    })
  })

  // 4. Girar la Ruleta
  btnSpin.addEventListener('click', async () => {
    if ( isSpinning || totalBetAmount === 0 ) {
        return
    }

    isSpinning = true
    setGameState('Girando...')
    btnSpin.disabled = true
    btnClear.disabled = true

    // Preparar array de apuestas para el backend
    const betsToSend = Object.keys(currentBets).map(type => ({
        type: type,
        amount: currentBets[type]
    }))

    try {
      // Enviar apuestas al servidor
      const response = await fetch('/roulette/spin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bets: betsToSend })
      })
      
      if ( !response.ok ) {
        const errData = await response.json()
        throw new Error(errData.error || 'Error en la apuesta')
      }

      const result = await response.json()
      
      // Iniciar animación
      await spinWheel(result.winningNumber)

      // Mostrar resultado
      const winColor = numberColors[result.winningNumber]
      showResultDisplay(`¡Ganó el ${result.winningNumber} ${winColor.charAt(0).toUpperCase() + winColor.slice(1)}!`, winColor)

      // Actualizar saldo y listas
      updateBalance(result.newBalance)
      updateLastNumbers(result.winningNumber, winColor)
      
      // Actualizar lista de últimas apuestas (simulado, idealmente el servidor devuelve esto)
      updateLastBets(betsToSend, result.totalWinnings, result.totalBet)
      
      // Limpiar para la siguiente ronda
      resetGame()

    } catch (error) {
      console.error('Error al girar:', error)
      showResultDisplay(error.message, 'error')
      resetGame() // Resetea el juego incluso si hay error
    }
  })

  // --- FUNCIONES AUXILIARES ---

  function setGameState(state) {
    gameStateDisplay.textContent = state
  }

  function updateBetDisplays() {
    totalBetDisplay.textContent = formatCurrency(totalBetAmount)
  }
  
  function updateBalance(newBalance) {
    currentBalance = newBalance
    userBalanceDisplay.textContent = formatCurrency(newBalance)
  }

  function visualizeChip(betOptionElement, value) {
    const chipVisual = document.createElement('div')
    chipVisual.classList.add('placed-chip')
    chipVisual.classList.add(`chip-value-${value}`)
    
    // Muestra la suma total de la apuesta en ese lugar
    const betType = betOptionElement.dataset.betType
    const amountOnSpot = currentBets[betType]
    
    // Simplificar valor (1000 -> 1K)
    let displayValue;
    if ( amountOnSpot >= 10000 ) displayValue = (amountOnSpot / 1000) + 'K'
    else if ( amountOnSpot >= 1000 ) displayValue = (amountOnSpot / 1000).toFixed(amountOnSpot % 1000 !== 0 ? 1 : 0) + 'K'
    else displayValue = amountOnSpot
    
    chipVisual.textContent = displayValue

    // Remover chip anterior si existe en este spot
    const existingChip = betOptionElement.querySelector('.placed-chip')
    if ( existingChip ) {
      existingChip.remove()
    }
    
    betOptionElement.appendChild(chipVisual)
  }

  function spinWheel(winningNumber) {
    return new Promise(resolve => {
      // 1. Busca el índice del número ganador en nuestro array ANTI-HORARIO
      const index = wheelNumbersOrder.indexOf(winningNumber);
      const slotAngle = 360 / wheelNumbersOrder.length;
      
      // 2. Calcula el ángulo de detención (centrado en el slot)
      const targetAngle = -(index * slotAngle);
      
      // 3. CÁLCULO DE LA RULETA (IMAGEN)
      // 5 rotaciones (sentido horario) + la posición final ANTI-HORARIA (-targetAngle)
      const wheelRotation = -targetAngle;

      // 4. CÁLCULO DE LA BOLA
      // 8 rotaciones (sentido anti-horario) + la misma posición final ANTI-HORARIA (-targetAngle)
      // La bola gira en dirección opuesta, pero ambas deben aterrizar en el mismo ángulo.
      const ballRotation = targetAngle + (slotAngle / 2);

      // 5. ANIMACIÓN
      
      // Animación de la ruleta (imagen)
      wheel.style.transition = 'all 4s cubic-bezier(0.2, 0.8, 0.7, 1)'; // Ease-out
      wheel.style.transform = `rotate(${wheelRotation}deg)`;

      // Animación de la bola
      ball.style.transition = 'all 4s cubic-bezier(0.1, 0.5, 0.3, 1)'; // Diferente ease
      ball.style.transform = `rotate(${ballRotation}deg)`;


      setTimeout(() => {
        // 6. RESETEO
        // Resetear transiciones para el próximo giro
        wheel.style.transition = 'none';
        ball.style.transition = 'none';

        // "Fijar" la rotación final (un valor entre -360 y 0)
        const finalRotation = wheelRotation % 360;

        // Ambas deben fijarse en la misma rotación final
        wheel.style.transform = `rotate(${finalRotation}deg)`;
        ball.style.transform = `rotate(${finalRotation}deg)`;

        resolve();
      }, 4100); // 4.1 segundos
    });
  }

  function showResultDisplay(message, type) {
    resultDisplay.textContent = message
    resultDisplay.parentElement.className = `result-display-${type}` // Cambia el color (verde, rojo, negro, error)
    resultDisplay.parentElement.style.opacity = 1

    setTimeout(() => {
      resultDisplay.parentElement.style.opacity = 0;
    }, 3000) // Ocultar después de 3 segundos
  }

  function resetGame() {
    isSpinning = false
    setGameState('Recibiendo apuestas')
    btnSpin.disabled = false
    btnClear.disabled = false
    currentBets = {}
    totalBetAmount = 0
    updateBetDisplays()
    document.querySelectorAll('.placed-chip').forEach(chip => chip.remove())
  }

  function updateLastNumbers(number, color) {
    const newItem = document.createElement('li')
    newItem.classList.add(`number-${color}`)
    newItem.textContent = number
    
    lastNumbersList.prepend(newItem);
    if ( lastNumbersList.children.length > 5 ) {
      lastNumbersList.removeChild(lastNumbersList.lastChild)
    }
  }

  function updateLastBets(bets, winnings, totalBet) {
    const newItem = document.createElement('li')
    const betSummary = bets.length > 1 ? `${bets.length} apuestas` : bets[0].type
    const profit = winnings - totalBet
    
    let resultClass, resultText;
    if ( profit > 0 ) {
      resultClass = 'result-win'
      resultText = `Ganó +${formatCurrency(profit)}`
    } else {
      resultClass = 'result-lose';
      resultText = `Perdió ${formatCurrency(totalBet)}`
    }

    newItem.innerHTML = `
      <span>${betSummary} (${formatCurrency(totalBet)})</span>
      <span class="${resultClass}">${resultText}</span>
    `
    
    lastBetsList.prepend(newItem);
    if ( lastBetsList.children.length > 5 ) {
      lastBetsList.removeChild(lastBetsList.lastChild)
    }
  }
  
  function formatCurrency(number) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(number)
  }
})
