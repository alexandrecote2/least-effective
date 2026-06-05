// ============================================================
// LEAST EFFECTIVE — PWA Client v2
// ============================================================

const ROLES = {
  ceo: { name: 'Le CEO', camp: 'mal', superpower: "Chaque quarter au closing (sauf Q1), vous remerciez un collaborateur. Personne ne connaît votre identité. Survivez aux votes et la restructuration sera complète." },
  consultant: { name: 'Le Consultant', camp: 'mal', superpower: "Chaque quarter au closing, choisissez un collègue à empoisonner — ses infos seront fausses sans qu'il le sache. En parallèle, un Deck de Slides (3 affirmations dont 1 fausse) est publié au café. Comme un vrai cabinet : cher et peu fiable." },
  drh: { name: 'Le DRH', camp: 'mal', superpower: "Chaque quarter au closing, bloquez le pouvoir d'un collaborateur Frontline. Il ne saura même pas que son action a été classée sans suite." },
  directeurFinancier: { name: 'Le Directeur Financier', camp: 'mal', superpower: "Lors du vote, inversez secrètement le vote d'un joueur ciblé. Les chiffres disent ce que vous voulez qu'ils disent." },
  fondateur: { name: 'Le Fondateur', camp: 'mal', superpower: "Usage unique. Quand le CEO se fait remercier par vote, redirigez le remerciement vers quelqu'un d'autre. Le CEO survit." },
  agentNettoyage: { name: "L'Agent de Nettoyage", camp: 'bien', superpower: "Chaque quarter au closing, sélectionnez 3 collègues. L'app vous dit combien sont Leadership. Il passe partout, personne ne le remarque." },
  analyste: { name: "L'Analyste", camp: 'bien', superpower: "Chaque quarter au closing, choisissez un collègue. Vous apprendrez combien de ses voisins directs (gauche/droite) sont dans le Leadership." },
  chasseurDeTetes: { name: 'Le Chasseur de Têtes', camp: 'bien', superpower: "Chaque quarter au closing, choisissez 2 collègues. Vous saurez si l'un d'eux est le CEO." },
  recruteur: { name: 'Le Recruteur', camp: 'bien', superpower: "Chaque quarter au closing, choisissez 2 collègues. On vous dit : 'Un de ces 2 est [rôle X]'." },
  assistanteDirection: { name: "L'Assistante de Direction", camp: 'bien', superpower: "Chaque quarter, vous apprenez quels rôles ont agi (mais pas qui). Elle sait tout ce qui se passe dans cette boîte." },
  alternant: { name: "L'Alternant", camp: 'bien', superpower: "Après chaque vote, vous apprenez si au moins un Advisor a voté pour le remerciement. Personne ne fait attention à lui, mais il note tout." },
  agentAccueil: { name: "L'Agent d'Accueil", camp: 'bien', superpower: "Quand quelqu'un est remercié par vote, vous apprenez secrètement son camp (pas son rôle). Il voit passer tout le monde au badge." },
  avocat: { name: "L'Avocat", camp: 'bien', superpower: "Chaque quarter au closing, protégez un collègue (pas vous-même). Vous ne saurez pas si votre protection a fonctionné avant la fin de la partie." },
  deleguePersonnel: { name: 'Le Délégué du Personnel', camp: 'bien', superpower: "Passif. Vous ne pouvez pas être remercié par le CEO. Votre CDI est en béton armé." },
  responsableInfo: { name: 'Le Responsable Informatique', camp: 'bien', superpower: "Chaque quarter au closing, verrouillez un joueur : il ne peut ni être ciblé, ni utiliser son pouvoir. Peut gêner les deux camps." },
  journaliste: { name: "Le Journaliste d'Investigation", camp: 'bien', superpower: "Usage unique, en phase Meeting. Déclarez une Class Action contre un joueur. Si c'est le CEO → victoire immédiate. Sinon → plainte classée sans suite." },
  lanceurAlerte: { name: "Le Lanceur d'Alerte", camp: 'bien', superpower: "À votre remerciement, vous forcez un vote sans secondement au quarter suivant contre un joueur de votre choix." },
  inspecteurTravail: { name: "L'Inspecteur du Travail", camp: 'bien', superpower: "Passif, usage unique. Le premier joueur qui vous nomine pour un Plan de Performance est immédiatement remercié à votre place." },
  cabinetReclassement: { name: 'Le Cabinet de Reclassement', camp: 'bien', superpower: "Usage unique. Réembauchez un joueur remercié : il revient actif avec son pouvoir." },
  burnout: { name: 'Le Burn-out', camp: 'bien', superpower: "Vous pensez avoir un vrai pouvoir. Toutes vos infos sont fausses. Vous êtes là physiquement, mentalement aux Maldives." },
  influenceur: { name: "L'Influenceur", camp: 'bien', superpower: "Le Leadership connaît votre identité dès le départ. Vous êtes trop visible. Ravi d'annoncer que j'ai rejoint cette aventure." },
  delegueSyndical: { name: 'Le Délégué Syndical', camp: 'bien', superpower: "Tant que vous êtes actif, il faut 2 secondements au lieu de 1 pour déclencher un Plan de Performance. On ne peut pas licencier comme ça." },
  coach: { name: 'Le Coach', camp: 'bien', superpower: "Chaque quarter au closing, vous copiez le pouvoir d'un rôle Frontline aléatoire. Imprévisible pour tout le monde y compris vous. On itère, on pivote." },
  actionnaireMajoritaire: { name: "L'Actionnaire Majoritaire", camp: 'bien', superpower: "Si vous êtes remercié par vote → le Leadership gagne immédiatement. Vous ne pouvez pas me virer. C'est moi qui possède la boîte." },
  stagiaire: { name: 'Le Stagiaire', camp: 'bien', superpower: "Aucun pouvoir au début. Quand un joueur Frontline est remercié, vous héritez de son pouvoir (et savez lequel). Change à chaque nouveau Frontline remercié." },
};

class App {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.gameCode = null;
    this.phase = 'home';
    this.round = 0;
    this.players = [];
    this.nominations = [];
    this.morningMessages = [];
    this.winner = null;
    this.myRole = null;
    this.myCamp = null;
    this.myRoleName = null;
    this.nightHasAction = false;
    this.nightTargetCount = 0;
    this.nightSelectablePlayers = [];
    this.nightRoleName = '';
    this.nightRole = '';
    this.nightActionDone = false;
    this.selectedTargets = new Set();
    this.isHost = false;
    this.playerName = '';
    this.errorMessage = '';
    this.showNominateUI = false;
    this.gameLog = [];
    this.reconnecting = false;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.gameCode && this.playerId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.reconnect();
        }
      }
    });

    this.render();
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname || 'localhost';
    const port = location.port || (protocol === 'wss:' ? 443 : 80);
    const wsUrl = port == 443 || port == 80 ? `${protocol}//${host}` : `${protocol}//${host}:${port}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => this.render();
    this.ws.onclose = () => {
      if (!this.reconnecting && this.gameCode) {
        this.reconnect();
      } else if (!this.reconnecting) {
        this.phase = 'disconnected';
        this.render();
      }
    };
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  }

  reconnect() {
    this.reconnecting = true;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname || 'localhost';
    const port = location.port || (protocol === 'wss:' ? 443 : 80);
    const wsUrl = port == 443 || port == 80 ? `${protocol}//${host}` : `${protocol}//${host}:${port}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnecting = false;
      this.send({ type: 'rejoinGame', code: this.gameCode, playerId: this.playerId, playerName: this.playerName });
    };
    this.ws.onclose = () => {
      this.reconnecting = false;
      this.phase = 'disconnected';
      this.render();
    };
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'connected':
        if (!this.playerId) {
          this.playerId = msg.playerId;
        }
        if (!this.gameCode) {
          this.phase = 'join';
        }
        break;
      case 'gameCreated':
        this.gameCode = msg.code;
        this.phase = 'lobby';
        break;
      case 'gameJoined':
        this.gameCode = msg.code;
        this.phase = 'lobby';
        break;
      case 'error':
        this.errorMessage = msg.message;
        break;
      case 'gameState':
        this.phase = msg.phase;
        this.round = msg.round;
        this.players = msg.players;
        this.nominations = msg.nominations || [];
        this.morningMessages = msg.morningMessages || [];
        this.winner = msg.winner;
        this.deckDeSlides = msg.deckDeSlides || null;
        if (msg.gameLog) this.gameLog = msg.gameLog;
        break;
      case 'yourRole':
        this.myRole = msg.role;
        this.myRoleName = msg.roleName;
        this.myCamp = msg.camp;
        this.bonusInfo = msg.bonusInfo || null;
        this.possibleRoles = msg.possibleRoles || [];
        this.phase = 'roleReveal';
        this.roleAcknowledged = false;
        break;
      case 'nightPrompt':
        this.nightHasAction = msg.hasAction;
        this.nightTargetCount = msg.targetCount || 0;
        this.nightSelectablePlayers = msg.selectablePlayers || [];
        this.nightRoleName = msg.roleName || '';
        this.nightRole = msg.role || '';
        this.nightHasChoice = msg.hasChoice || false;
        this.nightChoiceMade = null; // 'poison' or 'slides'
        this.nightActionDone = false;
        this.selectedTargets = new Set();
        this.privateResult = null;
        break;
      case 'privateResult':
        this.privateResult = msg.message;
        break;
    }
    this.render();
  }

  render() {
    const app = document.getElementById('app');

    // Role guide overlay
    if (this.showRoleGuide && this.possibleRoles?.length > 0) {
      app.innerHTML = `
        <div class="screen" style="gap:12px;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0 8px;">
            <h3 style="color:var(--accent);">📖 Guide des Rôles</h3>
            <button onclick="app.toggleRoleGuide()" style="background:none;border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;padding:6px 12px;cursor:pointer;">✕ Fermer</button>
          </div>
          <p class="dim" style="font-size:0.8rem;padding:0 8px;">Composition : ${this.players.filter(p => p.alive).length + this.players.filter(p => !p.alive).length} joueurs. Certains rôles ci-dessous ne sont peut-être pas en jeu.</p>
          ${this.possibleRoles.map(r => {
            const roleData = Object.values(ROLES).find(rd => rd.name === r) || {};
            const campDot = roleData.camp === 'mal' ? '🔴' : '🔵';
            return `<div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <p style="font-size:0.85rem;">${campDot} <strong>${r}</strong></p>
              <p class="dim" style="font-size:0.75rem;margin-top:4px;">${roleData.superpower || ''}</p>
            </div>`;
          }).join('')}
        </div>
      `;
      return;
    }

    switch (this.phase) {
      case 'home': app.innerHTML = this.renderHome(); break;
      case 'join': app.innerHTML = this.renderJoin(); break;
      case 'lobby': app.innerHTML = this.renderLobby(); break;
      case 'seatingOrder': app.innerHTML = this.renderSeating(); break;
      case 'roleReveal': app.innerHTML = this.renderRoleReveal(); break;
      case 'closingTheDay': app.innerHTML = this.renderClosing(); break;
      case 'pauseCafe': app.innerHTML = this.renderCafe(); break;
      case 'tractation': app.innerHTML = this.renderTractation(); break;
      case 'meeting': app.innerHTML = this.renderMeeting(); break;
      case 'gameEnd': app.innerHTML = this.renderGameEnd(); break;
      case 'disconnected': app.innerHTML = this.renderDisconnected(); break;
      default: app.innerHTML = this.renderHome();
    }
  }

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  renderPlayerHeader() {
    if (!this.playerName) return '';
    const roleName = this.myRoleName || '';
    const campColor = this.myCamp === 'mal' ? 'var(--red)' : 'var(--blue)';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div>
        <span style="opacity:0.6;font-size:0.75rem;">👤 ${this.playerName}</span>
        ${roleName ? `<span style="margin-left:8px;font-size:0.75rem;color:${campColor};font-weight:600;">${roleName}</span>` : ''}
      </div>
      <button onclick="app.toggleRoleGuide()" style="background:none;border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#fff;font-size:0.7rem;padding:4px 8px;cursor:pointer;">📖 Rôles</button>
    </div>`;
  }

  renderDayBar() {
    const phases = [
      { id: 'pauseCafe', time: '9h', label: 'Café', icon: '☕' },
      { id: 'tractation', time: '11h', label: 'Tractations', icon: '🤝' },
      { id: 'meeting', time: '17h', label: 'Meeting', icon: '👥' },
      { id: 'closingTheDay', time: '19h', label: 'Closing', icon: '🔒' },
    ];
    const currentIdx = phases.findIndex(p => p.id === this.phase);

    return `
      ${this.renderPlayerHeader()}
      <div class="day-bar">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;">
          <h2 style="margin:0;">Q${this.round}</h2>
          <span style="font-size:0.75rem;opacity:0.6;">👥 ${this.players.filter(p => p.alive).length} actifs / 🏖️ ${this.players.filter(p => !p.alive).length} remerciés</span>
        </div>
        <div class="phases">
          ${phases.map((p, i) => `
            <div class="phase-item ${i === currentIdx ? 'active' : i < currentIdx ? 'past' : ''}">
              <div class="icon">${p.icon}</div>
              <div class="time">${p.time}</div>
              <div class="label">${p.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // SCREENS
  // ============================================================

  renderHome() {
    return `
      <div class="screen" style="justify-content:center;align-items:center;gap:30px;background:linear-gradient(135deg, var(--logo-red) 0%, var(--logo-blue) 100%);">
        <img src="logo.png" alt="Least Effective" style="width:160px;height:160px;border-radius:32px;box-shadow:0 8px 32px rgba(0,0,0,0.4);background:linear-gradient(135deg, var(--logo-red), var(--logo-blue));">
        <div class="center">
          <h1 style="font-size:2.2rem;font-weight:900;">LEAST</h1>
          <h1 style="font-size:2.2rem;font-weight:900;color:var(--accent);">EFFECTIVE</h1>
          <p style="margin-top:8px;opacity:0.7;font-style:italic;">"Restructuring in progress"</p>
        </div>
        <button class="btn btn-primary" onclick="app.connect()">Rejoindre une partie</button>
        <p style="font-size:0.7rem;opacity:0.4;">v2.1 — "La Restructuration"</p>
      </div>
    `;
  }

  renderJoin() {
    return `
      <div class="screen" style="justify-content:center;gap:24px;background:linear-gradient(180deg, var(--logo-red) 0%, var(--logo-blue) 100%);">
        <img src="logo.png" alt="" style="width:60px;height:60px;border-radius:12px;align-self:center;background:linear-gradient(135deg, var(--logo-red), var(--logo-blue));">
        <h2 class="center" style="letter-spacing:3px;">MULTIJOUEUR</h2>
        <input id="nameInput" placeholder="Votre nom" value="${this.playerName}">
        <div class="gap">
          <button class="btn btn-primary" onclick="app.createGame()">Lancer une Initiative</button>
          <div style="display:flex;gap:8px;">
            <input id="codeInput" placeholder="CODE" style="font-family:monospace;letter-spacing:2px;">
            <button class="btn btn-secondary" style="width:auto;white-space:nowrap;" onclick="app.joinGame()">Rejoindre</button>
          </div>
        </div>
        ${this.errorMessage ? `<p style="color:var(--red);text-align:center;font-size:0.85rem;">${this.errorMessage}</p>` : ''}
      </div>
    `;
  }

  renderLobby() {
    return `
      <div class="screen" style="gap:24px;">
        <div class="center">
          <p class="dim" style="font-size:0.75rem;">Code de réunion</p>
          <h2 style="font-size:2rem;color:var(--accent);font-family:monospace;">${this.gameCode}</h2>
          <p class="dim" style="font-size:0.75rem;">Partagez à vos collègues</p>
        </div>
        <div>
          <p class="dim" style="font-size:0.7rem;letter-spacing:2px;margin-bottom:8px;">PARTICIPANTS (${this.players.length})</p>
          ${this.players.map(p => `
            <div class="player-item">
              <div class="player-dot connected"></div>
              <span>${p.name}</span>
              <span class="dim" style="margin-left:auto;font-size:0.7rem;">onboardé</span>
            </div>
          `).join('')}
        </div>
        <div class="spacer"></div>
        ${this.isHost ? `<button class="btn btn-primary" ${this.players.length < 2 ? 'disabled' : ''} onclick="app.startGame()">Lancer la Restructuration</button>` : '<p class="center dim italic">En attente du lancement...</p>'}
      </div>
    `;
  }

  renderSeating() {
    if (!this.seatingOrder) {
      this.seatingOrder = this.players.map(p => ({ id: p.id, name: p.name }));
    }
    const isHost = this.isHost;

    return `
      <div class="screen" style="gap:16px;">
        <div class="center" style="padding-top:20px;">
          <p class="dim" style="font-size:0.7rem;letter-spacing:3px;">🪑 PLAN DE TABLE</p>
          <h2 style="font-size:1.3rem;margin-top:8px;">Organisez l'ordre autour de la table</h2>
          <p class="dim italic" style="font-size:0.75rem;margin-top:4px;">De haut en bas = sens horaire</p>
        </div>
        ${isHost ? `
          <div style="flex:1;overflow-y:auto;">
            ${this.seatingOrder.map((p, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:4px;">
                <span class="dim" style="font-size:0.75rem;width:20px;">${i + 1}.</span>
                <span style="flex:1;">${p.name}</span>
                <button class="btn-move" onclick="app.moveSeat(${i}, -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-move" onclick="app.moveSeat(${i}, 1)" ${i === this.seatingOrder.length - 1 ? 'disabled' : ''}>▼</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary" onclick="app.confirmSeating()">Valider le plan de table</button>
        ` : `
          <div class="spacer"></div>
          <p class="dim italic center">L'hôte organise le plan de table...</p>
          <div class="spacer"></div>
        `}
      </div>
    `;
  }

  renderRoleReveal() {
    const role = ROLES[this.myRole] || {};
    const campClass = this.myCamp === 'mal' ? 'badge-leadership' : 'badge-frontline';
    const campLabel = this.myCamp === 'mal' ? 'Leadership' : 'Frontline';

    if (this.roleAcknowledged) {
      return `
        <div class="screen" style="justify-content:center;align-items:center;gap:20px;">
          ${this.renderPlayerHeader()}
          <div class="spacer"></div>
          <div style="font-size:2rem;">⏳</div>
          <p class="dim italic center">En attente des autres collaborateurs...</p>
          <p class="dim" style="font-size:0.75rem;">Gardez votre rôle pour vous.</p>
          <div class="spacer"></div>
        </div>
      `;
    }

    return `
      <div class="screen" style="gap:16px;">
        ${this.renderPlayerHeader()}
        <div class="center" style="padding-top:20px;">
          <p class="dim" style="font-size:0.7rem;letter-spacing:3px;">VOTRE FICHE DE POSTE</p>
          <h2 style="font-size:1.6rem;margin-top:12px;color:var(--accent);">${this.myRoleName}</h2>
          <div style="margin-top:12px;"><span class="badge ${campClass}">${campLabel}</span></div>
        </div>
        <div class="card mt">
          <p class="dim" style="font-size:0.7rem;letter-spacing:2px;margin-bottom:8px;">SUPERPOWER</p>
          <p>${role.superpower || ''}</p>
        </div>
        ${this.bonusInfo ? `
          <div class="card" style="border:1px solid var(--red);margin-top:12px;">
            <p style="white-space:pre-line;">${this.bonusInfo}</p>
          </div>
        ` : ''}
        ${this.possibleRoles.length > 0 ? `
          <div class="card" style="margin-top:12px;">
            <p class="dim" style="font-size:0.7rem;letter-spacing:2px;margin-bottom:8px;">RÔLES POSSIBLES DANS CETTE PARTIE</p>
            ${this.possibleRoles.map(r => {
              const roleData = Object.values(ROLES).find(rd => rd.name === r) || {};
              const campDot = roleData.camp === 'mal' ? '🔴' : '🔵';
              return `<p style="font-size:0.8rem;margin-top:6px;">${campDot} <strong>${r}</strong> — <span class="dim">${roleData.superpower || ''}</span></p>`;
            }).join('')}
            <p class="dim italic" style="font-size:0.7rem;margin-top:10px;">Certains de ces rôles ne sont peut-être pas en jeu.</p>
          </div>
        ` : ''}
        <div class="spacer"></div>
        <button class="btn btn-primary" onclick="app.acknowledgeRole()">J'ai lu mon contrat</button>
      </div>
    `;
  }

  renderClosing() {
    if (this.nightActionDone) {
      const done = this.players.filter(p => p.nightActionDone).length;
      const alive = this.players.filter(p => p.alive).length;
      return `
        <div class="screen closing" style="justify-content:center;align-items:center;gap:20px;">
          ${this.renderDayBar()}
          <div class="spacer"></div>
          <div class="icon-large">✓</div>
          <p class="dim italic center">Action soumise.<br>En attente des autres collaborateurs...</p>
          <p class="dim">${done}/${alive}</p>
          <div class="spacer"></div>
        </div>
      `;
    }

    if (this.nightHasAction) {
      const role = ROLES[this.nightRole] || {};

      return `
        <div class="screen closing" style="gap:16px;">
          ${this.renderDayBar()}
          <div class="center">
            <p style="color:var(--accent);font-weight:800;font-size:1.1rem;">${this.nightRoleName}</p>
            <p class="dim italic" style="font-size:0.8rem;margin-top:6px;padding:0 16px;">${role.superpower || ''}</p>
          </div>
          <p class="dim center" style="margin-top:8px;">Sélectionnez ${this.nightTargetCount} collègue${this.nightTargetCount > 1 ? 's' : ''}</p>
          <div style="flex:1;overflow-y:auto;">
            ${this.nightSelectablePlayers.map(p => `
              <div class="select-item ${this.selectedTargets.has(p.id) ? 'selected' : ''}" onclick="app.toggleTarget('${p.id}')">
                <div class="select-circle">${this.selectedTargets.has(p.id) ? '✓' : ''}</div>
                <span>${p.name}${p.alive === false ? ' 🏖️' : ''}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary" ${this.selectedTargets.size !== this.nightTargetCount ? 'disabled' : ''} onclick="app.submitNight()">Soumettre le rapport</button>
        </div>
      `;
    }

    // No action — "métro boulot dodo"
    const noActionRole = ROLES[this.nightRole] || {};
    return `
      <div class="screen closing" style="justify-content:center;align-items:center;gap:20px;">
        ${this.renderDayBar()}
        <div class="spacer"></div>
        <div class="center">
          <p style="color:var(--accent);font-weight:800;font-size:1rem;">${this.nightRoleName}</p>
          <p class="dim italic" style="font-size:0.75rem;margin-top:6px;padding:0 20px;">${noActionRole.superpower || ''}</p>
        </div>
        <div class="icon-large">🚇</div>
        <p style="font-size:1.2rem;color:var(--accent);font-weight:700;text-align:center;">Métro, boulot, dodo.</p>
        <p class="dim italic center">La journée est finie. Rien à signaler de votre côté.</p>
        <div class="spacer"></div>
        <button class="btn btn-primary" onclick="app.submitNightNoAction()">Rentrer chez soi</button>
      </div>
    `;
  }

  renderCafe() {
    const privateResultHTML = this.privateResult ? `
      <div class="card" style="border:1px solid var(--accent);margin-top:8px;">
        <p style="color:var(--accent);font-size:0.7rem;letter-spacing:2px;margin-bottom:8px;">📋 VOTRE RAPPORT CONFIDENTIEL</p>
        <p>${this.privateResult}</p>
      </div>
    ` : '';

    const slidesHTML = this.deckDeSlides ? `
      <div class="card" style="border:1px solid var(--orange);margin-top:8px;">
        <p style="color:var(--orange);font-size:0.7rem;letter-spacing:2px;margin-bottom:8px;">📊 DECK DE SLIDES — "Executive Summary"</p>
        ${this.deckDeSlides.map(s => `<p style="margin-top:6px;">• ${s}</p>`).join('')}
        <p class="dim italic" style="margin-top:10px;font-size:0.75rem;">2 de ces affirmations sont vraies. 1 est fausse.</p>
      </div>
    ` : '';

    return `
      <div class="screen cafe" style="gap:20px;">
        ${this.renderDayBar()}
        <div class="card">
          <p class="dim italic" style="margin-bottom:12px;">"La direction a le regret de vous informer que :"</p>
          ${this.morningMessages.map(m => `
            <div style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;">
              <span style="color:var(--orange);">⚠️</span>
              <p>${m}</p>
            </div>
          `).join('')}
        </div>
        ${privateResultHTML}
        ${slidesHTML}
        <p class="dim italic center">"Les bruits de couloir circulent. Profitez de la machine à café."</p>
        <div class="spacer"></div>
        ${this.isHost ? '<button class="btn btn-primary" onclick="app.advancePhase()">11h — Passer aux Tractations</button>' : ''}
      </div>
    `;
  }

  renderTractation() {
    return `
      <div class="screen tractation" style="justify-content:center;align-items:center;gap:24px;">
        ${this.renderDayBar()}
        <div class="spacer"></div>
        <p class="dim italic center">"Discutez, négociez, manipulez.<br>La direction compte sur votre transparence."</p>
        <div class="spacer"></div>
        ${this.isHost ? '<button class="btn btn-primary" onclick="app.advancePhase()">17h — Aller en Meeting</button>' : ''}
      </div>
    `;
  }

  renderMeeting() {
    // Class Action UI overlay
    if (this.showClassActionUI) {
      const alivePlayers = this.players.filter(p => p.alive && p.id !== this.playerId);
      return `
        <div class="screen meeting" style="gap:16px;">
          ${this.renderDayBar()}
          <h3 class="center" style="color:var(--red);">⚖️ CLASS ACTION</h3>
          <p class="dim italic center">Si la cible est le CEO → victoire immédiate.<br>Sinon → plainte classée sans suite. Usage unique.</p>
          <div style="flex:1;overflow-y:auto;">
            ${alivePlayers.map(p => `
              <div class="select-item" onclick="app.confirmClassAction('${p.id}')">
                <div class="select-circle"></div>
                <span>${p.name}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost" onclick="app.cancelClassAction()">Annuler</button>
        </div>
      `;
    }

    // Nominate UI overlay
    if (this.showNominateUI) {
      const alivePlayers = this.players.filter(p => p.alive && p.id !== this.playerId);
      return `
        <div class="screen meeting" style="gap:16px;">
          ${this.renderDayBar()}
          <h3 class="center" style="color:var(--accent);">Qui mérite un feedback constructif ?</h3>
          <div style="flex:1;overflow-y:auto;">
            ${alivePlayers.map(p => `
              <div class="select-item" onclick="app.confirmNominate('${p.id}')">
                <div class="select-circle"></div>
                <span>${p.name}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost" onclick="app.cancelNominate()">Annuler</button>
        </div>
      `;
    }

    return `
      <div class="screen meeting" style="gap:16px;">
        ${this.renderDayBar()}
        ${this.nominations.length ? (() => {
          const me = this.players.find(p => p.id === this.playerId);
          const canVote = me && (me.alive || !me.hasUsedDeadVote);
          return this.nominations.map(n => {
            const voted = n.voters.includes(this.playerId);
            let voteUI = '';
            if (voted) {
              voteUI = '<span style="color:green;">✓ Voté</span>';
            } else if (!canVote) {
              voteUI = '<span class="dim" style="font-size:0.7rem;">vote épuisé</span>';
            } else {
              voteUI = `<button class="vote-btn" onclick="app.vote('${n.targetId}')">Voter</button>`;
            }
            return `
              <div class="nom-card">
                <span style="font-weight:600;">${n.targetName}</span>
                <div style="display:flex;align-items:center;gap:8px;">${voteUI}</div>
              </div>
            `;
          }).join('');
        })() : '<p class="dim italic center mt">Aucune nomination pour l\'instant</p>'}
        <div class="spacer"></div>
        ${(() => {
          const me = this.players.find(p => p.id === this.playerId);
          const amAlive = me && me.alive;
          let buttons = '';
          if (amAlive && this.myRole === 'journaliste' && !this.classActionUsed) {
            buttons += `<button class="btn btn-secondary" style="border-color:var(--red);color:var(--red);" onclick="app.showClassAction()">⚖️ Lancer une Class Action</button>`;
          }
          if (amAlive) {
            buttons += `<button class="btn btn-primary" onclick="app.showNominate()">Proposer un Plan de Performance</button>`;
          } else {
            buttons += `<p class="dim italic center" style="font-size:0.8rem;">🏖️ Vous êtes en transition professionnelle</p>`;
          }
          if (this.isHost) {
            buttons += `<button class="btn btn-secondary" onclick="app.closeDay()">19h — Clore la journée</button>`;
          }
          return buttons;
        })()}
      </div>
    `;
  }

  renderGameEnd() {
    const isFrontline = this.winner === 'frontline';

    // Build role reveal from gameLog
    let roleRevealHTML = '';
    if (this.gameLog && this.gameLog.roles) {
      roleRevealHTML = `
        <div style="width:100%;max-width:400px;">
          <p class="dim" style="font-size:0.7rem;letter-spacing:2px;margin-bottom:12px;text-align:center;">RÉVÉLATION DES DOSSIERS RH</p>
          ${this.gameLog.roles.map(p => {
            const role = ROLES[p.role] || {};
            const campColor = role.camp === 'mal' ? 'var(--red)' : 'var(--blue)';
            const statusIcon = p.alive ? '' : ' 💀';
            return `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="width:8px;height:8px;border-radius:50%;background:${campColor};"></div>
                <span style="flex:1;">${p.name}${statusIcon}</span>
                <span style="color:${campColor};font-size:0.8rem;">${role.name || p.role}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Build round-by-round history
    let historyHTML = '';
    if (this.gameLog && this.gameLog.history) {
      historyHTML = `
        <div style="width:100%;max-width:400px;margin-top:20px;">
          <p class="dim" style="font-size:0.7rem;letter-spacing:2px;margin-bottom:12px;text-align:center;">POST-MORTEM — ROUND PAR ROUND</p>
          ${this.gameLog.history.map(round => `
            <div class="card" style="margin-bottom:8px;padding:12px;">
              <p style="color:var(--accent);font-weight:700;font-size:0.85rem;">Q${round.round}</p>
              ${round.events.map(e => `<p class="dim" style="font-size:0.8rem;margin-top:4px;">• ${e}</p>`).join('')}
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="screen" style="align-items:center;gap:20px;padding:20px;overflow-y:auto;">
        <div class="icon-large">${isFrontline ? '🎉' : '🏢'}</div>
        <h2 style="color:${isFrontline ? 'var(--accent)' : 'var(--red)'};">${isFrontline ? 'RESTRUCTURATION AVORTÉE' : 'RESTRUCTURATION FINALISÉE'}</h2>
        <p style="font-size:1.1rem;color:${isFrontline ? 'var(--blue)' : 'var(--red)'};">${isFrontline ? 'LA FRONTLINE GAGNE' : 'LE LEADERSHIP GAGNE'}</p>
        ${roleRevealHTML}
        ${historyHTML}
        <button class="btn btn-secondary" style="margin-top:20px;max-width:300px;" onclick="location.reload()">Nouvelle Initiative</button>
      </div>
    `;
  }

  renderDisconnected() {
    return `
      <div class="screen" style="justify-content:center;align-items:center;gap:20px;">
        <p class="dim">Connexion perdue.</p>
        <button class="btn btn-primary" onclick="location.reload()">Reconnecter</button>
      </div>
    `;
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  createGame() {
    this.playerName = document.getElementById('nameInput')?.value || 'Joueur';
    if (!this.playerName) return;
    this.isHost = true;
    this.send({ type: 'createGame', playerName: this.playerName });
  }

  joinGame() {
    this.playerName = document.getElementById('nameInput')?.value || 'Joueur';
    const code = document.getElementById('codeInput')?.value || '';
    if (!this.playerName || !code) return;
    this.send({ type: 'joinGame', code: code.toUpperCase(), playerName: this.playerName });
  }

  startGame() {
    this.send({ type: 'startGame' });
  }

  moveSeat(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.seatingOrder.length) return;
    const temp = this.seatingOrder[index];
    this.seatingOrder[index] = this.seatingOrder[newIndex];
    this.seatingOrder[newIndex] = temp;
    this.render();
  }

  confirmSeating() {
    this.send({ type: 'confirmSeating', order: this.seatingOrder.map(p => p.id) });
  }

  acknowledgeRole() {
    this.send({ type: 'roleAcknowledged' });
    this.roleAcknowledged = true;
    this.render();
  }

  toggleTarget(id) {
    if (this.selectedTargets.has(id)) {
      this.selectedTargets.delete(id);
    } else if (this.selectedTargets.size < this.nightTargetCount) {
      this.selectedTargets.add(id);
    } else if (this.nightTargetCount === 1) {
      this.selectedTargets = new Set([id]);
    }
    this.render();
  }

  consultingChoice(mode) {
    this.nightChoiceMade = mode;
    this.render();
  }

  submitNight() {
    this.send({ type: 'nightAction', targets: [...this.selectedTargets], mode: this.nightChoiceMade || 'default' });
    this.nightActionDone = true;
    this.render();
  }

  submitNightSlides() {
    this.send({ type: 'nightAction', targets: [], mode: 'slides' });
    this.nightActionDone = true;
    this.render();
  }

  submitNightNoAction() {
    this.send({ type: 'nightAction', targets: [] });
    this.nightActionDone = true;
    this.render();
  }

  advancePhase() {
    this.send({ type: 'advancePhase' });
  }

  showNominate() {
    this.showNominateUI = true;
    this.render();
  }

  cancelNominate() {
    this.showNominateUI = false;
    this.render();
  }

  confirmNominate(targetId) {
    this.send({ type: 'nominate', targetId });
    this.showNominateUI = false;
    this.render();
  }

  showClassAction() {
    this.showClassActionUI = true;
    this.render();
  }

  cancelClassAction() {
    this.showClassActionUI = false;
    this.render();
  }

  confirmClassAction(targetId) {
    this.send({ type: 'classAction', targetId });
    this.classActionUsed = true;
    this.showClassActionUI = false;
    this.render();
  }

  vote(targetId) {
    this.send({ type: 'vote', targetId });
  }

  toggleRoleGuide() {
    this.showRoleGuide = !this.showRoleGuide;
    this.render();
  }

  closeDay() {
    this.send({ type: 'closeDay' });
  }
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

const app = new App();
