// --- MÓDULO DE LA API DE TRELLO ---
const trelloApi = {
    apiKey: '42c42b2aeb78d2b5048bc85c88041207',
    token: '5d2c98ce4d6ca544fca293a91f7720b55d79832cdf431358705656707ea11e1b',
    boardId: '4nP65kjP',
    accountsListId: '65f10a46b34fce29bd56c327',
    movimientosListId: '65f269323f5a0b15806db352',
    idsListId: '66d1e623c53f70e9b9acc846',

    async request(endpoint, options = {}) {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `https://api.trello.com/1/${endpoint}${separator}key=${this.apiKey}&token=${this.token}`;
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Error de Trello: ${response.statusText}`);
            return response.json();
        } catch (error) { console.error("Error en la petición a Trello:", error); throw error; }
    },
    async getBoardCards() { return this.request(`boards/${this.boardId}/cards?fields=name,id,idList`); },
    async updateCardName(cardId, newName) { return this.request(`cards/${cardId}?name=${encodeURIComponent(newName)}`, { method: 'PUT' }); },
    async createCard(idList, name) { return this.request(`cards?idList=${idList}&name=${encodeURIComponent(name)}`, { method: 'POST' }); }
};

// --- UTILIDADES ---
const Utils = {
    getParams: () => Object.fromEntries(new URLSearchParams(window.location.search)),
    parseCardData: (cardName) => {
        const parts = cardName.split(' | ');
        if (parts.length < 7) return null;
        return { username: parts[0], password: parts[1], balance: parts[2], email: parts[3], storeEnabled: parts[4], activated: parts[5], cardEnabled: parts[6] };
    },
    formatCardData: (data) => `${data.username} | ${data.password} | ${data.balance} | ${data.email} | ${data.storeEnabled} | ${data.activated} | ${data.cardEnabled}`,
    generateRandomID: () => Math.floor(10000 + Math.random() * 90000),
    showMenu: (menuId) => {
        document.querySelectorAll('.menu-container').forEach(menu => menu.hidden = true);
        const menuToShow = document.getElementById(menuId);
        if (menuToShow) menuToShow.hidden = false;
    },
    clearFormFields: (...forms) => { forms.forEach(id => document.getElementById(id)?.reset()); }
};

// --- LÓGICA DE LA APLICACIÓN ---
const App = {
    state: {},
    init() {
        this.state.currentUser = Utils.getParams();
        if (!this.state.currentUser.user) {
            alert('Error: No se encontró información de usuario.');
            window.location.href = './index_redesigned.html';
            return;
        }
        this.setupUI();
        this.setupEventListeners();
        this.updateUI();
    },
    setupUI() {
        document.getElementById('email').textContent = this.state.currentUser.email || 'No disponible';
        document.getElementById('name-store').textContent = this.state.currentUser.user;
        document.getElementById('name-purchase').textContent = this.state.currentUser.user;
        document.getElementById('transfer-sender').value = this.state.currentUser.user;
        document.getElementById('transfer-sender').disabled = true;
        const verifiedUsers = ['PAT_Gobierno', 'PAT_Municipio', 'BankPatata', 'Support-BankPatata'];
        if (verifiedUsers.includes(this.state.currentUser.user)) {
            const verifiedIcon = '<div class="verified-icon"></div>';
            document.getElementById('name-store').innerHTML += verifiedIcon;
            document.getElementById('name-purchase').innerHTML += verifiedIcon;
        }
        if (this.state.currentUser.user === 'BankPatata' || this.state.currentUser.user === 'Support-BankPatata') {
            document.querySelector('.btn-options').hidden = false;
        }
        document.querySelector('#menu_normal .menu-header h1').textContent = `Hola, ${this.state.currentUser.user}`;
    },
    async updateUI() {
        try {
            const cards = await trelloApi.getBoardCards();
            const accountCard = cards.find(c => c.name.startsWith(`${this.state.currentUser.user} |`));
            if (accountCard) {
                const data = Utils.parseCardData(accountCard.name);
                Object.assign(this.state.currentUser, data);
                this.displayBalance();
                this.displayCardStatus();
            }
            if (this.state.currentUser.storeEnabled === 'storeNO') {
                const userTransactions = cards.filter(card => 
                    card.idList === trelloApi.idsListId &&
                    (card.name.includes(`| FROM: ${this.state.currentUser.user} |`) || card.name.includes(`| TO: ${this.state.currentUser.user} |`))
                );
                this.displayTransactions(userTransactions);
            }
        } catch (error) {
            console.error("Fallo en updateUI:", error);
            alert("Error al actualizar la información de la cuenta.");
        }
    },
    displayBalance() {
        const { balance } = this.state.currentUser;
        const isInfinite = balance === 'inf';
        const formattedBalance = isInfinite ? 'INFINITO' : parseFloat(balance).toFixed(2);
        document.getElementById('balance').textContent = formattedBalance;
        document.getElementById('balance-store').textContent = formattedBalance;
        document.querySelectorAll('.dolar-symbol').forEach(el => el.style.display = isInfinite ? 'none' : 'inline');
    },
    displayCardStatus() {
        const { cardEnabled } = this.state.currentUser;
        const isEnabled = cardEnabled === 'true';
        const statusText = isEnabled ? '<strong>Habilitado</strong>' : '<strong>Deshabilitado</strong>';
        document.getElementById('card-status').innerHTML = statusText;
        document.getElementById('account-status-store').innerHTML = statusText;
    },
    displayTransactions(transactionCards) {
        const container = document.getElementById('transactions-container');
        if (!container) return;
        container.innerHTML = '';
        const parsedTransactions = transactionCards.map(card => {
            const parts = card.name.split(' | ').reduce((obj, part) => {
                const [key, ...value] = part.split(': ');
                obj[key.trim()] = value.join(': ');
                return obj;
            }, {});
            return parts;
        });
        parsedTransactions.sort((a, b) => new Date(b.ISO_DATE) - new Date(a.ISO_DATE));
        parsedTransactions.forEach(parts => {
            const currentUser = this.state.currentUser.user;
            let type, sign, amountClass, mainDescription;
            const descriptionFromData = parts.DESC;
            if (parts.TYPE === 'DEPOSIT' || (parts.TYPE === 'TRANSFER' && parts.TO === currentUser)) {
                type = (parts.TYPE === 'DEPOSIT') ? 'INGRESO' : 'TRANSFERENCIA RECIBIDA';
                sign = '+';
                amountClass = 'positive';
                mainDescription = (parts.TYPE === 'DEPOSIT') ? descriptionFromData : `De: ${parts.FROM}`;
            } else {
                type = (parts.TYPE === 'PURCHASE') ? 'GASTO' : (parts.TYPE === 'RETIRO' ? 'GASTO' : 'TRANSFERENCIA ENVIADA');
                sign = '-';
                amountClass = 'negative';
                mainDescription = descriptionFromData;
            }
            const div = document.createElement('div');
            div.className = 'transaction';
            const timestamp = parts.ISO_DATE ? new Date(parts.ISO_DATE).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Fecha no disponible';
            div.innerHTML = `<div class="transaction-main"><div class="transaction-details"><span class="transaction-description">${mainDescription}</span><span class="transaction-timestamp">${timestamp}</span></div><div class="transaction-amount ${amountClass}">${sign} $${parseFloat(parts.AMOUNT).toFixed(2)}</div></div><div class="transaction-extra-details"><div class="detail-row"><span class="detail-label">ID de Transacción:</span><span class="detail-value">${parts['#']}</span></div><div class="detail-row"><span class="detail-label">Banco:</span><span class="detail-value">BankPatata</span></div><div class="detail-row"><span class="detail-label">Tipo:</span><span class="detail-value">${type}</span></div>${parts.TYPE === 'TRANSFER' ? `<div class="detail-row"><span class="detail-label">Enviado por:</span><span class="detail-value">${parts.FROM}</span></div><div class="detail-row"><span class="detail-label">Recibido por:</span><span class="detail-value">${parts.TO}</span></div>` : ''}</div>`;
            div.addEventListener('click', () => div.classList.toggle('open'));
            container.appendChild(div);
        });
    },
    setupEventListeners() {
        // Navegación de menús
        document.querySelector('.btn-purchase-beta')?.addEventListener('click', () => Utils.showMenu('menu_purchases'));
        document.querySelector('.btn-options')?.addEventListener('click', () => Utils.showMenu('menu_options'));
        
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => {
                Utils.showMenu(btn.dataset.target);
                document.getElementById('modify-step-1').hidden = false;
                document.getElementById('modify-step-2').hidden = true;
                Utils.clearFormFields('purchase-form', 'deposit-form', 'retiro-form', 'transfer-form', 'admin-create-form', 'admin-modify-form');
            });
        });

        // LÍNEA CORREGIDA: Eliminada la llave extra y el punto y coma.
        document.querySelectorAll('button[data-menu]').forEach(btn => {
            btn.addEventListener('click', () => Utils.showMenu(btn.dataset.menu));
        });

        // Formularios de transacciones
        document.getElementById('purchase-form')?.addEventListener('submit', e => {
            e.preventDefault();
            const d = new FormData(e.target);
            this.handleTransaction('purchase', d.get('user'), d.get('description'), parseFloat(d.get('price')));
        });
        document.getElementById('deposit-form')?.addEventListener('submit', e => {
            e.preventDefault();
            const d = new FormData(e.target);
            this.handleTransaction('deposit', d.get('user'), 'DEPOSITO BANKPATATA', parseFloat(d.get('price')));
        });
        document.getElementById('retiro-form')?.addEventListener('submit', e => {
            e.preventDefault();
            const d = new FormData(e.target);
            this.handleTransaction('retiro', d.get('user'), 'RETIRO BANKPATATA', parseFloat(d.get('price')));
        });
        document.getElementById('transfer-form')?.addEventListener('submit', e => {
            e.preventDefault();
            const d = new FormData(e.target);
            this.handleTransaction('transfer', d.get('user1'), d.get('description'), parseFloat(d.get('price')), d.get('user2'));
        });

        // Formularios de Administración
        document.getElementById('admin-create-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this.handleAdminCreateAccount(
                document.getElementById('admin-create-user').value,
                document.getElementById('admin-create-email').value,
                document.getElementById('admin-create-pass').value
            );
        });
        
        document.getElementById('btn-find-user')?.addEventListener('click', async () => {
            const username = document.getElementById('admin-modify-user').value.trim();
            if (!username) return alert('Por favor, ingresa un nombre de usuario.');
            
            const allCards = await trelloApi.getBoardCards();
            const userCard = allCards.find(c => c.name.startsWith(`${username} |`));

            if (!userCard) return alert(`No se encontró un usuario llamado '${username}'.`);

            this.state.modifyingUser = { id: userCard.id, data: Utils.parseCardData(userCard.name) };
            
            document.getElementById('admin-modify-status').value = this.state.modifyingUser.data.activated;
            document.getElementById('admin-modify-card').value = this.state.modifyingUser.data.cardEnabled;
            document.getElementById('modify-step-1').hidden = true;
            document.getElementById('modify-step-2').hidden = false;
        });

        document.getElementById('admin-modify-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this.handleAdminModifyAccount(
                document.getElementById('admin-modify-status').value,
                document.getElementById('admin-modify-card').value
            );
        });

        // Botones y otros
        document.querySelectorAll('.btn-logout').forEach(btn => btn.addEventListener('click', this.logout));
        document.querySelectorAll('.btn-unimplemented').forEach(btn => btn.addEventListener('click', () => alert('Esta función aún no está implementada.')));
    },
    async handleAdminCreateAccount(username, email, password) {
        if (!username || !email || !password) return alert('Todos los campos son obligatorios.');
        try {
            const cards = await trelloApi.getBoardCards();
            if (cards.some(c => c.name.startsWith(`${username} |`))) {
                return alert(`El nombre de usuario '${username}' ya existe.`);
            }
            const newAccountName = `${username} | ${password} | 0 | ${email} | storeNO | new | false`;
            const newMovementsName = `${username} / BankPatata-ACTIVATION & 0.00 & ${new Date().toISOString()}`;
            await trelloApi.createCard(trelloApi.accountsListId, newAccountName);
            await trelloApi.createCard(trelloApi.movimientosListId, newMovementsName);
            alert(`¡Cuenta para '${username}' creada con éxito!`);
            Utils.clearFormFields('admin-create-form');
            Utils.showMenu('menu_cuentas');
        } catch (error) {
            alert(`Error al crear la cuenta: ${error.message}`);
        }
    },
    async handleAdminModifyAccount(newStatus, newCardStatus) {
        const { id, data } = this.state.modifyingUser;
        if (!id || !data) return alert('Error: No hay ningún usuario seleccionado para modificar.');
        data.activated = newStatus;
        data.cardEnabled = newCardStatus;
        try {
            await trelloApi.updateCardName(id, Utils.formatCardData(data));
            alert(`¡El estado de la cuenta '${data.username}' ha sido actualizado!`);
            document.getElementById('modify-step-1').hidden = false;
            document.getElementById('modify-step-2').hidden = true;
            Utils.clearFormFields('admin-modify-form');
            Utils.showMenu('menu_cuentas');
            delete this.state.modifyingUser;
        } catch (error) {
            alert(`Error al modificar la cuenta: ${error.message}`);
        }
    },

    handleTransaction(type, user1, description, amount, user2 = null) {
        if (user1.toLowerCase() === 'all' && ['purchase', 'deposit', 'retiro'].includes(type)) {
            this.handleBulkTransaction(type, description, amount);
        } else {
            this.handleSingleTransaction(type, user1, description, amount, user2);
        }
    },

    async handleSingleTransaction(type, user1, description, amount, user2 = null) {
        if (!user1 || !description || isNaN(amount)) return alert("Por favor, completa todos los campos correctamente.");
        const transId = Utils.generateRandomID();
        try {
            const allCards = await trelloApi.getBoardCards();
            const senderCard = allCards.find(c => c.name.startsWith(`${user1} |`));
            if (!senderCard) return alert(`Error: El usuario '${user1}' no fue encontrado.`);
            const senderData = Utils.parseCardData(senderCard.name);
            let receiverCard = null, receiverData = null;
            const targetUser = type === 'transfer' ? user2 : (type === 'purchase' ? this.state.currentUser.user : user1);
            if (type === 'transfer' || type === 'purchase') {
                 receiverCard = allCards.find(c => c.name.startsWith(`${targetUser} |`));
                 if(!receiverCard) return alert(`Error: El usuario beneficiario '${targetUser}' no fue encontrado.`);
                 receiverData = Utils.parseCardData(receiverCard.name);
            }
            if(senderData.cardEnabled !== 'true') return alert("Rechazado: La tarjeta del usuario de origen está bloqueada.");
            if(type === 'transfer' && receiverData.cardEnabled !== 'true') return alert("Rechazado: La tarjeta del beneficiario está bloqueada.");
            if(senderData.balance !== 'inf' && parseFloat(senderData.balance) < amount) return alert("Rechazado: Fondos insuficientes.");
            let newSenderBalance = senderData.balance, newReceiverBalance = receiverData ? receiverData.balance : null;
            if (senderData.balance !== 'inf') {
                const sBalance = parseFloat(senderData.balance);
                if (['retiro', 'transfer', 'purchase'].includes(type)) newSenderBalance = sBalance - amount;
                if (type === 'deposit') newSenderBalance = sBalance + amount;
            }
             if (receiverData && receiverData.balance !== 'inf') {
                const rBalance = parseFloat(receiverData.balance);
                if (['transfer', 'purchase'].includes(type)) newReceiverBalance = rBalance + amount;
            }
            senderData.balance = newSenderBalance;
            await trelloApi.updateCardName(senderCard.id, Utils.formatCardData(senderData));
            if(receiverCard) {
                receiverData.balance = newReceiverBalance;
                await trelloApi.updateCardName(receiverCard.id, Utils.formatCardData(receiverData));
            }
            const timestamp = new Date();
            const transactionDetail = `${description} & ${amount.toFixed(2)} & ${timestamp.toISOString()}`;
            const idCardName = `#: ${transId} | TYPE: ${type.toUpperCase()} | FROM: ${user1} | TO: ${targetUser || 'N/A'} | DESC: ${description} | AMOUNT: ${amount.toFixed(2)} | ISO_DATE: ${timestamp.toISOString()}`;
            await trelloApi.createCard(trelloApi.idsListId, idCardName);
            const senderMovementsCard = allCards.find(c => c.name.startsWith(`${user1} /`));
            if (senderMovementsCard) await trelloApi.updateCardName(senderMovementsCard.id, `${senderMovementsCard.name} ! ${transactionDetail}`);
            if (type === 'transfer' && user2) {
                 const receiverMovementsCard = allCards.find(c => c.name.startsWith(`${user2} /`));
                 if (receiverMovementsCard) await trelloApi.updateCardName(receiverMovementsCard.id, `${receiverMovementsCard.name} ! ${transactionDetail}`);
            }
            alert(`¡Transacción #${transId} realizada con éxito!`);
            this.updateUI();
            Utils.clearFormFields('purchase-form', 'deposit-form', 'retiro-form', 'transfer-form');
            if (['purchase', 'deposit', 'retiro', 'transfer'].includes(type)) {
                Utils.showMenu(this.state.currentUser.storeEnabled === 'storeYES' ? 'menu_store' : 'menu_normal');
            }
        } catch (error) {
            alert(`Error al procesar la transacción: ${error.message}`);
        }
    },

    async handleBulkTransaction(type, description, amount) {
        const confirmation = confirm(`ATENCIÓN: Estás a punto de ejecutar una operación de tipo '${type.toUpperCase()}' por un monto de $${amount.toFixed(2)} a TODOS los usuarios. ¿Estás seguro? Esta acción no se puede deshacer.`);
        if (!confirmation) return;

        alert('Iniciando operación masiva. Esto puede tardar unos segundos. Recibirás una notificación al finalizar.');

        try {
            const allCards = await trelloApi.getBoardCards();
            const adminUsers = ['BankPatata', 'Support-BankPatata'];
            const targetAccountCards = allCards.filter(c => 
                c.idList === trelloApi.accountsListId && 
                !adminUsers.includes(c.name.split(' | ')[0])
            );
            
            const promises = [];
            let processedCount = 0;

            for (const accountCard of targetAccountCards) {
                const userData = Utils.parseCardData(accountCard.name);
                if (!userData || userData.cardEnabled !== 'true') continue;

                let newBalance = userData.balance;
                if (userData.balance !== 'inf') {
                    const currentBalance = parseFloat(userData.balance);
                    if (type === 'purchase' || type === 'retiro') {
                        if (currentBalance < amount) continue;
                        newBalance = currentBalance - amount;
                    } else if (type === 'deposit') {
                        newBalance = currentBalance + amount;
                    }
                }

                userData.balance = newBalance;
                const updatedAccountName = Utils.formatCardData(userData);
                promises.push(trelloApi.updateCardName(accountCard.id, updatedAccountName));
                
                const transId = Utils.generateRandomID();
                const timestamp = new Date();
                const transactionDetail = `${description} & ${amount.toFixed(2)} & ${timestamp.toISOString()}`;
                const idCardName = `#: ${transId} | TYPE: BULK_${type.toUpperCase()} | FROM: ${this.state.currentUser.user} | TO: ${userData.username} | DESC: ${description} | AMOUNT: ${amount.toFixed(2)} | ISO_DATE: ${timestamp.toISOString()}`;
                
                const movementsCard = allCards.find(c => c.name.startsWith(`${userData.username} /`));
                if (movementsCard) {
                    promises.push(trelloApi.updateCardName(movementsCard.id, `${movementsCard.name} ! ${transactionDetail}`));
                }
                promises.push(trelloApi.createCard(trelloApi.idsListId, idCardName));
                processedCount++;
            }

            await Promise.all(promises);
            alert(`¡Operación masiva completada! Se aplicó la transacción a ${processedCount} de ${targetAccountCards.length} usuarios.`);
            
            this.updateUI();
            Utils.clearFormFields('purchase-form', 'deposit-form', 'retiro-form');
        } catch (error) {
            alert(`Error durante la operación masiva: ${error.message}`);
        }
    },
    logout() {
        window.location.href = './index_redesigned.html';
    }
};

// --- PUNTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    const params = Utils.getParams();
    if (params.storeEnabled === 'storeYES') {
        Utils.showMenu('menu_store');
    } else {
        Utils.showMenu('menu_normal');
    }
    App.init();
});