/**
 * Objeto para centralizar la configuración y las llamadas a la API de Trello.
 */
const trelloApi = {
    apiKey: '42c42b2aeb78d2b5048bc85c88041207',
    token: '5d2c98ce4d6ca544fca293a91f7720b55d79832cdf431358705656707ea11e1b',
    boardId: '4nP65kjP',
    accountsListId: '65f10a46b34fce29bd56c327',
    movimientosListId: '65f269323f5a0b15806db352'
};

/**
 * Realiza una petición a la API de Trello.
 * @param {string} endpoint - El endpoint de la API a consultar.
 * @param {object} options - Opciones para la petición fetch.
 * @returns {Promise<any>} - La respuesta de la API en formato JSON.
 */
async function request(endpoint, options = {}) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `https://api.trello.com/1/${endpoint}${separator}key=${trelloApi.apiKey}&token=${trelloApi.token}`;
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Error de Trello: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error en la petición a Trello:", error);
        throw error;
    }
}

/**
 * Obtiene todas las tarjetas de un tablero.
 * @returns {Promise<Array>} - Una lista de tarjetas.
 */
async function getBoardCards() {
    return request(`boards/${trelloApi.boardId}/cards`);
}

/**
 * Crea una nueva tarjeta en Trello.
 * @param {string} idList - El ID de la lista donde se creará la tarjeta.
 * @param {string} name - El nombre de la nueva tarjeta.
 * @returns {Promise<object>} - La tarjeta creada.
 */
async function createCard(idList, name) {
    const endpoint = `cards?idList=${idList}&name=${encodeURIComponent(name)}`;
    return request(endpoint, { method: 'POST' });
}


/**
 * Parsea los datos de una tarjeta de cuenta.
 * @param {string} cardName - El nombre de la tarjeta.
 * @returns {object|null} - Un objeto con los datos del usuario o null si el formato es incorrecto.
 */
function parseAccountCard(cardName) {
    const parts = cardName.split(' | ');
    if (parts.length < 7) return null;
    return {
        username: parts[0],
        password: parts[1],
        balance: parts[2],
        email: parts[3],
        storeEnabled: parts[4],
        activated: parts[5],
        cardEnabled: parts[6]
    };
}

/**
 * Maneja el proceso de inicio de sesión.
 * @param {string} username - El nombre de usuario.
 * @param {string} password - La contraseña.
 */
async function handleLogin(username, password) {
    try {
        const cards = await getBoardCards();
        const userCardData = cards
            .map(card => parseAccountCard(card.name))
            .find(data => data && data.username === username && data.password === password);

        if (!userCardData) {
            throw new Error('Usuario o contraseña inválidos.');
        }

        if (userCardData.activated === 'new') {
            throw new Error('Tu cuenta es nueva y necesita ser activada. Por favor, llama a 1800-BANKPATATA para activarla.');
        }

        if (userCardData.activated !== 'true') {
            throw new Error('Tu cuenta está deshabilitada. Si crees que es un error, contacta con soporte.');
        }

        const urlParams = new URLSearchParams({
            user: userCardData.username,
            accountStatus: userCardData.activated,
            storeEnabled: userCardData.storeEnabled,
            email: userCardData.email,
            balance: userCardData.balance,
            cardEnabled: userCardData.cardEnabled,
        });
        window.location.href = `./main_redesigned.html?${urlParams.toString()}`;

    } catch (error) {
        alert(`Error al iniciar sesión: ${error.message}`);
    }
}

/**
 * Maneja el proceso de registro.
 * @param {string} username - El nombre de usuario.
 * @param {string} email - El correo electrónico.
 * @param {string} password - La contraseña.
 */
async function handleRegister(username, email, password) {
    try {
        const cards = await getBoardCards();
        const userExists = cards.some(card => {
            const existingUsername = card.name.split(' | ')[0];
            return existingUsername === username;
        });

        if (userExists) {
            throw new Error('El nombre de usuario ya existe. Por favor, intenta iniciar sesión.');
        }

        const newAccountName = `${username} | ${password} | 0 | ${email} | storeNO | new | false`;
        const newMovementsName = `${username} / BankPatata-ACTIVATION & 0.00 & ${new Date().toISOString()}`;

        await createCard(trelloApi.accountsListId, newAccountName);
        await createCard(trelloApi.movimientosListId, newMovementsName); 

        alert('¡Cuenta registrada con éxito! Ahora serás redirigido para que puedas iniciar sesión.');
        location.reload();

    } catch (error) {
        alert(`Error en el registro: ${error.message}`);
    }
}


/**
 * Inicializa los listeners de eventos cuando el DOM está cargado.
 */
document.addEventListener('DOMContentLoaded', () => {
    // CORRECCIÓN: Se apunta al nuevo contenedor '.auth-container'
    const authContainer = document.querySelector('.auth-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const signUpBtnLink = document.querySelector('.signUpBtn-link');
    const signInBtnLink = document.querySelector('.signInBtn-link');

    if (!authContainer) return; // Si no existe el contenedor, no hacer nada.

    // Listener para el enlace "Regístrate ahora"
    signUpBtnLink.addEventListener('click', (e) => {
        e.preventDefault();
        // CORRECCIÓN: Se añade la clase al nuevo contenedor
        authContainer.classList.add('active');
    });

    // Listener para el enlace "Inicia sesión"
    signInBtnLink.addEventListener('click', (e) => {
        e.preventDefault();
        // CORRECCIÓN: Se quita la clase del nuevo contenedor
        authContainer.classList.remove('active');
    });

    // Listener para el formulario de login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-password').value.trim();
        if (user && pass) {
            handleLogin(user, pass);
        }
    });

    // Listener para el formulario de registro
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('register-user').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const pass = document.getElementById('register-password').value.trim();
        const terms = document.getElementById('register-terms').checked;

        if (!terms) {
            alert('Debes aceptar los términos y condiciones para continuar.');
            return;
        }

        if (user && email && pass) {
            handleRegister(user, email, pass);
        }
    });
});