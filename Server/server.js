const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const WEB_DIR = path.join(__dirname, '..', 'Web');

// ============================================================
// HTTP Server — serves the PWA files
// ============================================================

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(WEB_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ============================================================
// WebSocket Server
// ============================================================

const wss = new WebSocket.Server({ server });

const games = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createGame(hostId, hostName) {
  const code = generateCode();
  const game = {
    code,
    hostId,
    phase: 'lobby',
    round: 1,
    players: [{ id: hostId, name: hostName, role: null, alive: true, hasUsedDeadVote: false, connected: true, roleAcknowledged: false, nightActionDone: false }],
    nightActions: {},
    currentPlayerIndex: 0,
    pendingVoteElimination: null,
    nominations: [],
    voteResult: null,
    morningMessages: [],
    winner: null,
    history: [], // round-by-round log for post-mortem
  };
  games.set(code, game);
  return game;
}

const ROLES = {
  // CEO
  ceo: { name: 'Le CEO', category: 'ceo', camp: 'mal' },
  // Advisors
  consultant: { name: 'Le Consultant', category: 'advisor', camp: 'mal' },
  drh: { name: 'Le DRH', category: 'advisor', camp: 'mal' },
  directeurFinancier: { name: 'Le Directeur Financier', category: 'advisor', camp: 'mal' },
  fondateur: { name: 'Le Fondateur', category: 'advisor', camp: 'mal' },
  // Frontline — Info
  agentNettoyage: { name: "L'Agent de Nettoyage", category: 'frontline', camp: 'bien' },
  analyste: { name: "L'Analyste", category: 'frontline', camp: 'bien' },
  chasseurDeTetes: { name: 'Le Chasseur de Têtes', category: 'frontline', camp: 'bien' },
  recruteur: { name: 'Le Recruteur', category: 'frontline', camp: 'bien' },
  assistanteDirection: { name: "L'Assistante de Direction", category: 'frontline', camp: 'bien' },
  alternant: { name: "L'Alternant", category: 'frontline', camp: 'bien' },
  agentAccueil: { name: "L'Agent d'Accueil", category: 'frontline', camp: 'bien' },
  // Frontline — Protection
  avocat: { name: "L'Avocat", category: 'frontline', camp: 'bien' },
  deleguePersonnel: { name: 'Le Délégué du Personnel', category: 'frontline', camp: 'bien' },
  responsableInfo: { name: 'Le Responsable Informatique', category: 'frontline', camp: 'bien' },
  // Frontline — Action
  journaliste: { name: "Le Journaliste d'Investigation", category: 'frontline', camp: 'bien' },
  lanceurAlerte: { name: "Le Lanceur d'Alerte", category: 'frontline', camp: 'bien' },
  inspecteurTravail: { name: "L'Inspecteur du Travail", category: 'frontline', camp: 'bien' },
  cabinetReclassement: { name: 'Le Cabinet de Reclassement', category: 'frontline', camp: 'bien' },
  // Outsiders
  burnout: { name: 'Le Burn-out', category: 'outsider', camp: 'bien' },
  influenceur: { name: "L'Influenceur", category: 'outsider', camp: 'bien' },
  delegueSyndical: { name: 'Le Délégué Syndical', category: 'outsider', camp: 'bien' },
  coach: { name: 'Le Coach', category: 'outsider', camp: 'bien' },
  actionnaireMajoritaire: { name: "L'Actionnaire Majoritaire", category: 'outsider', camp: 'bien' },
  stagiaire: { name: 'Le Stagiaire', category: 'outsider', camp: 'bien' },
};

function getRolesForPlayerCount(n) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  let roles = [];

  // Core frontline (always available)
  const coreFrontline = ['agentNettoyage', 'analyste', 'chasseurDeTetes', 'avocat',
    'deleguePersonnel', 'alternant', 'journaliste'];
  // 9+ frontline
  const midFrontline = ['assistanteDirection', 'lanceurAlerte', 'agentAccueil'];
  // 11+ frontline
  const lateFrontline = ['responsableInfo'];
  // 12+ frontline
  const laterFrontline = ['inspecteurTravail'];
  // 15+ frontline
  const endFrontline = ['recruteur', 'cabinetReclassement'];

  // Build frontline pool based on player count
  let frontlinePool = [...coreFrontline];
  if (n >= 9) frontlinePool.push(...midFrontline);
  if (n >= 11) frontlinePool.push(...lateFrontline);
  if (n >= 12) frontlinePool.push(...laterFrontline);
  if (n >= 15) frontlinePool.push(...endFrontline);

  // Outsider pool based on player count
  const coreOutsiders = ['burnout', 'influenceur'];
  let outsiderPool = [...coreOutsiders];
  if (n >= 9) outsiderPool.push('delegueSyndical', 'coach', 'stagiaire');
  if (n >= 12) outsiderPool.push('actionnaireMajoritaire');

  if (n <= 5) {
    roles.push('ceo');
    roles.push(...shuffle(frontlinePool).slice(0, n - 1));
  } else if (n <= 8) {
    roles.push('ceo', 'consultant');
    roles.push(shuffle(outsiderPool)[0]);
    roles.push(...shuffle(frontlinePool).slice(0, n - 3));
  } else if (n <= 10) {
    roles.push('ceo', 'consultant');
    roles.push(...shuffle(outsiderPool).slice(0, 2));
    roles.push(...shuffle(frontlinePool).slice(0, n - 4));
  } else if (n <= 12) {
    roles.push('ceo', 'consultant', 'drh');
    roles.push(...shuffle(outsiderPool).slice(0, 2));
    roles.push(...shuffle(frontlinePool).slice(0, n - 5));
  } else if (n === 13) {
    roles.push('ceo', 'consultant', 'drh');
    roles.push(...shuffle(outsiderPool).slice(0, 2));
    roles.push(...shuffle(frontlinePool).slice(0, 8));
  } else if (n === 14) {
    roles.push('ceo', 'consultant', 'drh', 'directeurFinancier');
    roles.push(...shuffle(outsiderPool).slice(0, 2));
    roles.push(...shuffle(frontlinePool).slice(0, 8));
  } else if (n <= 17) {
    roles.push('ceo', 'consultant', 'drh', 'directeurFinancier');
    roles.push(...shuffle(outsiderPool).slice(0, 3));
    roles.push(...shuffle(frontlinePool).slice(0, n - 7));
  } else {
    roles.push('ceo', 'consultant', 'drh', 'directeurFinancier', 'fondateur');
    roles.push(...shuffle(outsiderPool).slice(0, 3));
    roles.push(...shuffle(frontlinePool).slice(0, n - 8));
  }

  return shuffle(roles);
}

function distributeRoles(game) {
  const roleKeys = getRolesForPlayerCount(game.players.length);
  game.players.forEach((p, i) => {
    p.role = roleKeys[i];
  });

  // Burn-out: assign a fake role (an info Frontline role for maximum confusion)
  const burnoutPlayer = game.players.find(p => p.role === 'burnout');
  if (burnoutPlayer) {
    const infoRoles = ['agentNettoyage', 'analyste', 'chasseurDeTetes', 'assistanteDirection'];
    // Pick a role that's already in the game (so it's credible in the role list)
    const existingInfoRoles = game.players.filter(p => infoRoles.includes(p.role)).map(p => p.role);
    if (existingInfoRoles.length > 0) {
      burnoutPlayer.fakeRole = existingInfoRoles[Math.floor(Math.random() * existingInfoRoles.length)];
    } else {
      burnoutPlayer.fakeRole = infoRoles[Math.floor(Math.random() * infoRoles.length)];
    }
  }
}

function getAlivePlayers(game) {
  return game.players.filter(p => p.alive);
}

function needsNightAction(role, round) {
  const actionRoles = ['ceo', 'drh', 'consultant', 'avocat', 'responsableInfo',
    'agentNettoyage', 'analyste', 'chasseurDeTetes', 'recruteur', 'stagiaire'];
  if (role === 'ceo' && round <= 1) return false;
  return actionRoles.includes(role);
}

function targetCount(role) {
  if (['ceo', 'drh', 'consultant', 'avocat', 'responsableInfo', 'analyste'].includes(role)) return 1;
  if (['chasseurDeTetes', 'recruteur'].includes(role)) return 2;
  if (role === 'agentNettoyage') return 3;
  return 0;
}

function generateDeckDeSlides(game) {
  const alive = game.players.filter(p => p.alive);
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const statements = [];

  // Generate 2 true statements
  const trueStatements = [];
  const evil = alive.filter(p => ROLES[p.role]?.camp === 'mal');
  const good = alive.filter(p => ROLES[p.role]?.camp === 'bien');

  // True: "[player] est dans la Frontline"
  if (good.length > 0) {
    const p = shuffle(good)[0];
    trueStatements.push(`${p.name} est dans la Frontline`);
  }
  // True: "[player] n'est PAS le CEO"
  const notCeo = alive.filter(p => p.role !== 'ceo');
  if (notCeo.length > 0) {
    const p = shuffle(notCeo)[0];
    trueStatements.push(`${p.name} n'est pas le CEO`);
  }
  // True: "Il y a X membres du Leadership actifs"
  trueStatements.push(`Il y a ${evil.length} membres du Leadership encore actifs`);
  // True: "[player] a un pouvoir actif"
  const withPower = alive.filter(p => needsNightAction(p.role, game.round));
  if (withPower.length > 0) {
    const p = shuffle(withPower)[0];
    trueStatements.push(`${p.name} a un pouvoir actif`);
  }

  // Pick 2 true ones
  const pickedTrue = shuffle(trueStatements).slice(0, 2);
  statements.push(...pickedTrue);

  // Generate 1 false statement (must be credible given known composition)
  const falseStatements = [];
  // False: "[evil player] est dans la Frontline"
  if (evil.length > 0) {
    const p = shuffle(evil)[0];
    falseStatements.push(`${p.name} est dans la Frontline`);
  }
  // False: "[good player] est dans le Leadership"
  if (good.length > 0) {
    const p = shuffle(good)[0];
    falseStatements.push(`${p.name} est dans le Leadership`);
  }
  // False: wrong number but credible (never exceed total known composition)
  if (evil.length > 0 && evil.length - 1 >= 0) {
    falseStatements.push(`Il y a ${evil.length - 1} membres du Leadership encore actifs`);
  }
  // False: "[good player] n'a aucun pouvoir actif" (but they do)
  const goodWithPower = good.filter(p => needsNightAction(p.role, game.round));
  if (goodWithPower.length > 0) {
    const p = shuffle(goodWithPower)[0];
    falseStatements.push(`${p.name} n'a aucun pouvoir actif`);
  }
  // False: "[evil player] n'a pas d'alliés dans cette partie"
  if (evil.length >= 2) {
    const p = shuffle(evil)[0];
    falseStatements.push(`${p.name} n'a aucun allié dans cette partie`);
  }

  const pickedFalse = shuffle(falseStatements)[0];
  statements.push(pickedFalse);

  // Shuffle so the false one isn't always last
  return shuffle(statements);
}

function getNeighbors(game, player) {
  const alive = game.players.filter(p => p.alive);
  const idx = alive.findIndex(p => p.id === player.id);
  if (idx === -1 || alive.length < 2) return [];
  const left = alive[(idx - 1 + alive.length) % alive.length];
  const right = alive[(idx + 1) % alive.length];
  return [left, right];
}

function resolveNight(game) {
  const actions = game.nightActions;
  const players = game.players;
  const findPlayer = id => players.find(p => p.id === id);

  // Private results to send to each player after resolution
  game.privateResults = {}; // playerId -> message
  const leadershipPlayers = players.filter(p => ROLES[p.role]?.camp === 'mal');

  players.forEach(p => { p.blocked = false; p.protected = false; p.poisoned = false; });
  // Burn-out is always "poisoned" — always receives false info
  const burnoutPlayer = players.find(p => p.role === 'burnout' && p.alive);
  if (burnoutPlayer) burnoutPlayer.poisoned = true;

  // 1. DRH blocks
  if (actions.drh?.targets?.[0]) {
    const target = findPlayer(actions.drh.targets[0]);
    if (target) target.blocked = true;
  }

  // 2. Consulting — always poisons target AND generates slides (no feedback)
  game.deckDeSlides = null;
  const consultingPlayer = players.find(p => p.role === 'consultant' && p.alive);
  if (consultingPlayer) {
    if (actions.consultant?.targets?.[0]) {
      const target = findPlayer(actions.consultant.targets[0]);
      if (target) target.poisoned = true;
    }
    game.deckDeSlides = generateDeckDeSlides(game);
  }

  // 3. IT Manager locks
  if (actions.responsableInfo?.targets?.[0]) {
    const target = findPlayer(actions.responsableInfo.targets[0]);
    if (target) { target.protected = true; target.blocked = true; }
  }

  // 4. Avocat protects
  let juristeTarget = null;
  if (actions.avocat?.targets?.[0]) {
    juristeTarget = findPlayer(actions.avocat.targets[0]);
    if (juristeTarget) juristeTarget.protected = true;
  }

  // Apply pending vote elimination
  game.morningMessages = [];
  const roundEvents = [];

  if (game.pendingVoteElimination) {
    const votedOut = findPlayer(game.pendingVoteElimination);
    if (votedOut) {
      // Actionnaire Majoritaire — if voted out, Leadership wins immediately
      if (votedOut.role === 'actionnaireMajoritaire') {
        votedOut.alive = false;
        game.winner = 'leadership';
        game.phase = 'gameEnd';
        game.history.push({ round: game.round, events: [`💀 ${votedOut.name} (L'Actionnaire Majoritaire) a été remercié(e) par vote — LE LEADERSHIP GAGNE !`] });
        game.pendingVoteElimination = null;
        return;
      }
      votedOut.alive = false;
      game.morningMessages.push(`${votedOut.name} a été remercié(e). Son dossier RH reste confidentiel.`);
      roundEvents.push(`${votedOut.name} remercié(e) par vote collectif`);

      // Stagiaire — inherits power of dead Frontline
      if (ROLES[votedOut.role]?.category === 'frontline') {
        const stagiaire = players.find(p => p.role === 'stagiaire' && p.alive);
        if (stagiaire) {
          stagiaire.inheritedRole = votedOut.role;
          game.privateResults[stagiaire.id] = `📋 Promotion ! Vous héritez du pouvoir de ${ROLES[votedOut.role]?.name}. Vous pouvez l'utiliser dès le prochain quarter.`;
        }
      }
    }
    game.pendingVoteElimination = null;
  }

  // 5. CEO kills
  if (game.round >= 2 && actions.ceo?.targets?.[0]) {
    const target = findPlayer(actions.ceo.targets[0]);
    if (target && !target.protected && target.role !== 'deleguePersonnel') {
      target.alive = false;
      game.morningMessages.push(`${target.name} a été remercié(e). Son dossier RH reste confidentiel.`);
      roundEvents.push(`${target.name} remercié(e) par le CEO`);
      // Stagiaire inherits from CEO-killed Frontline
      if (ROLES[target.role]?.category === 'frontline') {
        const stagiaire = players.find(p => p.role === 'stagiaire' && p.alive);
        if (stagiaire) {
          stagiaire.inheritedRole = target.role;
          game.privateResults[stagiaire.id] = `📋 Promotion ! Vous héritez du pouvoir de ${ROLES[target.role]?.name}. Vous pouvez l'utiliser dès le prochain quarter.`;
        }
      }
    } else if (target && target.protected) {
      roundEvents.push(`${target.name} ciblé(e) par le CEO mais protégé(e)`);
    } else if (target && target.role === 'deleguePersonnel') {
      roundEvents.push(`${target.name} ciblé(e) par le CEO mais CDI en béton`);
    }
  }

  // 6. Juriste — no feedback during game (revealed in post-mortem only)

  // 7. Agent de Nettoyage — choisit 3 joueurs, combien sont Leadership
  if (actions.agentNettoyage?.targets?.length >= 1) {
    const agent = findPlayer(actions.agentNettoyage.playerId);
    if (agent && !agent.blocked) {
      const targets = actions.agentNettoyage.targets.map(id => findPlayer(id)).filter(Boolean);
      let evilCount = targets.filter(t => ROLES[t.role]?.camp === 'mal').length;
      if (agent.poisoned) {
        const maxCredible = Math.min(targets.length, leadershipPlayers.length);
        const wrong = [0, 1, 2, 3].filter(n => n !== evilCount && n <= maxCredible);
        evilCount = wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : (evilCount === 0 ? 1 : 0);
      }
      const names = targets.map(t => t.name).join(', ');
      game.privateResults[agent.id] = `Rapport de nettoyage : parmi ${names}, ${evilCount} ${evilCount > 1 ? 'sont' : 'est'} dans le Leadership.`;
    }
  }

  // 8. Analyste — choisit un joueur, combien de ses voisins sont Leadership
  if (actions.analyste?.targets?.[0]) {
    const analyste = findPlayer(actions.analyste.playerId);
    const target = findPlayer(actions.analyste.targets[0]);
    if (analyste && target && !analyste.blocked) {
      const neighbors = getNeighbors(game, target);
      let evilCount = neighbors.filter(n => ROLES[n.role]?.camp === 'mal').length;
      if (analyste.poisoned) {
        const wrong = [0, 1, 2].filter(n => n !== evilCount);
        evilCount = wrong[Math.floor(Math.random() * wrong.length)];
      }
      game.privateResults[analyste.id] = `Analyse de proximité sur ${target.name} : ${evilCount} de ses voisins directs ${evilCount > 1 ? 'sont' : 'est'} dans le Leadership.`;
    }
  }

  // 9. Chasseur de Têtes — is one of the 2 the CEO?
  if (actions.chasseurDeTetes?.targets?.length >= 2) {
    const chasseur = findPlayer(actions.chasseurDeTetes.playerId);
    if (chasseur && !chasseur.blocked) {
      const targets = actions.chasseurDeTetes.targets.map(id => findPlayer(id)).filter(Boolean);
      let isCeoHere = targets.some(t => t.role === 'ceo');
      if (chasseur.poisoned) {
        isCeoHere = Math.random() > 0.5;
      }
      const names = targets.map(t => t.name).join(' et ');
      game.privateResults[chasseur.id] = isCeoHere
        ? `Investigation : OUI, l'un de ${names} est le CEO.`
        : `Investigation : NON, aucun de ${names} n'est le CEO.`;
    }
  }

  // 10. Recruteur — "un de ces 2 est [rôle X]"
  if (actions.recruteur?.targets?.length >= 2) {
    const recruteur = findPlayer(actions.recruteur.playerId);
    if (recruteur && !recruteur.blocked) {
      const targets = actions.recruteur.targets.map(id => findPlayer(id)).filter(Boolean);
      if (targets.length >= 2) {
        // Pick one of the two targets and reveal their role
        const revealed = targets[Math.floor(Math.random() * 2)];
        const revealedRoleName = ROLES[revealed.role]?.name || revealed.role;
        const names = targets.map(t => t.name).join(' et ');
        if (recruteur.poisoned) {
          // Give a wrong but credible role (from roles actually in this game, excluding the real ones)
          const realRoles = targets.map(t => ROLES[t.role]?.name);
          const allGameRoles = game.players.map(p => ROLES[p.role]?.name).filter(Boolean);
          const credibleFakes = allGameRoles.filter(r => !realRoles.includes(r));
          const fakeRole = credibleFakes.length > 0 ? credibleFakes[Math.floor(Math.random() * credibleFakes.length)] : 'Le Trader';
          game.privateResults[recruteur.id] = `Après analyse des CV : un de ${names} est ${fakeRole}.`;
        } else {
          game.privateResults[recruteur.id] = `Après analyse des CV : un de ${names} est ${revealedRoleName}.`;
        }
      }
    }
  }

  // 11. Executive Assistant — which role acted?
  const eaPlayer = players.find(p => p.role === 'assistanteDirection' && p.alive && !p.blocked);
  if (eaPlayer) {
    const rolesActed = Object.keys(actions).filter(r => r !== 'assistanteDirection').map(r => ROLES[r]?.name || r);
    if (eaPlayer.poisoned) {
      // Credible: pick roles that exist in this game and have night actions
      const credibleRoles = game.players
        .filter(p => p.alive && p.id !== eaPlayer.id && needsNightAction(p.role, game.round))
        .map(p => ROLES[p.role]?.name).filter(Boolean);
      const fakeSet = credibleRoles.length > 0 ? credibleRoles : ['Le Juriste', 'Le Consulting'];
      const picked = fakeSet.sort(() => Math.random() - 0.5).slice(0, Math.min(2, fakeSet.length));
      game.privateResults[eaPlayer.id] = `${picked.join(', ')} ${picked.length > 1 ? 'ont été très impliqués' : 'a été très impliqué'} ce dernier quarter.`;
    } else if (rolesActed.length > 0) {
      game.privateResults[eaPlayer.id] = `${rolesActed.join(', ')} ${rolesActed.length > 1 ? 'ont été très impliqués' : 'a été très impliqué'} ce dernier quarter.`;
    } else {
      game.privateResults[eaPlayer.id] = `Aucune activité détectée ce quarter. Étrange.`;
    }
  }


  // 12. Burn-out — resolve their fake action with fake results
  if (burnoutPlayer && burnoutPlayer.fakeRole) {
    const burnoutAction = actions[`burnout_${burnoutPlayer.fakeRole}`];
    if (burnoutAction?.targets?.length > 0) {
      const targets = burnoutAction.targets.map(id => findPlayer(id)).filter(Boolean);
      const fakeRole = burnoutPlayer.fakeRole;
      // Generate a fake result matching the fakeRole format
      if (fakeRole === 'agentNettoyage' && targets.length >= 1) {
        const fakeCount = Math.floor(Math.random() * Math.min(4, targets.length + 1));
        const names = targets.map(t => t.name).join(', ');
        game.privateResults[burnoutPlayer.id] = `Rapport de nettoyage : parmi ${names}, ${fakeCount} ${fakeCount > 1 ? 'sont' : 'est'} dans le Leadership.`;
      } else if (fakeRole === 'analyste' && targets[0]) {
        const fakeCount = Math.floor(Math.random() * 3);
        game.privateResults[burnoutPlayer.id] = `Analyse de proximité sur ${targets[0].name} : ${fakeCount} de ses voisins directs ${fakeCount > 1 ? 'sont' : 'est'} dans le Leadership.`;
      } else if (fakeRole === 'chasseurDeTetes' && targets.length >= 2) {
        const fakeAnswer = Math.random() > 0.5;
        const names = targets.map(t => t.name).join(' et ');
        game.privateResults[burnoutPlayer.id] = fakeAnswer
          ? `Investigation : OUI, l'un de ${names} est le CEO.`
          : `Investigation : NON, aucun de ${names} n'est le CEO.`;
      } else if (fakeRole === 'assistanteDirection') {
        const fakeRoles = game.players.filter(p => p.alive).map(p => ROLES[p.role]?.name).filter(Boolean);
        const picked = fakeRoles.sort(() => Math.random() - 0.5).slice(0, 2);
        game.privateResults[burnoutPlayer.id] = `${picked.join(', ')} ${picked.length > 1 ? 'ont été très impliqués' : 'a été très impliqué'} ce dernier quarter.`;
      }
    }
  }

  // Log all night actions for post-mortem (self-explanatory sentences)
  for (const [role, action] of Object.entries(actions)) {
    const actor = findPlayer(action.playerId);
    if (!actor) continue;
    const targetPlayers = action.targets.map(id => findPlayer(id)).filter(Boolean);
    const names = targetPlayers.map(p => p.name).join(' et ');

    switch (role) {
      case 'ceo':
        break;
      case 'drh':
        roundEvents.push(`🚫 ${actor.name} (DRH) a empêché ${names} d'utiliser son pouvoir cette nuit — ${names} n'a rien reçu et ne le sait pas`);
        break;
      case 'consultant':
        roundEvents.push(`💉📊 ${actor.name} (Consultant) a empoisonné ${names} (infos fausses) + publié un Deck de Slides`);
        break;
      case 'avocat':
        roundEvents.push(`🛡️ ${actor.name} (Avocat) a protégé ${names} — si le CEO l'avait ciblé(e), le remerciement est annulé`);
        break;
      case 'responsableInfo':
        roundEvents.push(`🔒 ${actor.name} (Responsable Informatique) a verrouillé ${names} — ni ciblable, ni actif ce quarter`);
        break;
      case 'agentNettoyage':
        roundEvents.push(`🔍 ${actor.name} (Agent de Nettoyage) a vérifié combien parmi ${names} sont Leadership (résultat : un chiffre reçu en privé)`);
        break;
      case 'analyste':
        roundEvents.push(`📊 ${actor.name} (Analyste) a vérifié combien de voisins de ${names} sont dans le Leadership (résultat reçu en privé)`);
        break;
      case 'chasseurDeTetes':
        roundEvents.push(`🎯 ${actor.name} (Chasseur de Têtes) a investigué ${names} pour savoir si l'un d'eux est le CEO (réponse oui/non en privé)`);
        break;
      case 'recruteur':
        roundEvents.push(`📋 ${actor.name} (Recruteur) a examiné ${names} pour identifier un rôle spécifique parmi eux`);
        break;
      default:
        if (targetPlayers.length > 0) {
          roundEvents.push(`${actor.name} (${ROLES[role]?.name || role}) a ciblé ${names}`);
        }
    }
  }

  game.history.push({ round: game.round, events: roundEvents });

  if (game.morningMessages.length === 0) {
    game.morningMessages.push("Aucun remerciement pour l'instant. Suspicieux.");
  }

  checkWinConditions(game);
}

function checkWinConditions(game) {
  const ceo = game.players.find(p => p.role === 'ceo');
  if (ceo && !ceo.alive) {
    game.winner = 'frontline';
    game.phase = 'gameEnd';
    return;
  }
  const alivePlayers = game.players.filter(p => p.alive);
  if (alivePlayers.length <= 2) {
    game.winner = 'leadership';
    game.phase = 'gameEnd';
    return;
  }
}

// ============================================================
// WebSocket message handling
// ============================================================

const clients = new Map();

wss.on('connection', (ws) => {
  let playerId = uuidv4();
  clients.set(ws, { playerId, gameCode: null });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    const client = clients.get(ws);
    const { type } = msg;

    switch (type) {
      case 'createGame': {
        const game = createGame(playerId, msg.playerName);
        client.gameCode = game.code;
        send(ws, { type: 'gameCreated', code: game.code, playerId });
        broadcastGameState(game);
        break;
      }

      case 'joinGame': {
        const game = games.get(msg.code?.toUpperCase());
        if (!game) { send(ws, { type: 'error', message: "Code invalide. Escaladez." }); break; }
        if (game.phase !== 'lobby') { send(ws, { type: 'error', message: "La réunion a déjà commencé." }); break; }
        game.players.push({ id: playerId, name: msg.playerName, role: null, alive: true, hasUsedDeadVote: false, connected: true, roleAcknowledged: false, nightActionDone: false });
        client.gameCode = game.code;
        send(ws, { type: 'gameJoined', code: game.code, playerId });
        broadcastGameState(game);
        break;
      }

      case 'rejoinGame': {
        const game = games.get(msg.code?.toUpperCase());
        if (!game) { send(ws, { type: 'error', message: "Partie introuvable." }); break; }
        const existingPlayer = game.players.find(p => p.id === msg.playerId);
        if (!existingPlayer) { send(ws, { type: 'error', message: "Joueur introuvable dans cette partie." }); break; }
        existingPlayer.connected = true;
        client.gameCode = game.code;
        client.playerId = msg.playerId;
        // Reassign the playerId for this connection
        playerId = msg.playerId;
        send(ws, { type: 'gameJoined', code: game.code, playerId: msg.playerId });
        broadcastGameState(game);
        // Resend role info if game already started
        if (existingPlayer.role) {
          const influenceur = game.players.find(p => p.role === 'influenceur');
          const leadershipPlayers = game.players.filter(p => ROLES[p.role]?.camp === 'mal');
          const displayRole = existingPlayer.fakeRole || existingPlayer.role;
          const roleMsg = {
            type: 'yourRole',
            role: displayRole,
            roleName: ROLES[displayRole]?.name || ROLES[existingPlayer.role].name,
            category: ROLES[displayRole]?.category || ROLES[existingPlayer.role].category,
            camp: ROLES[displayRole]?.camp || ROLES[existingPlayer.role].camp,
          };
          const bonuses = [];
          const nbMal = leadershipPlayers.length;
          const nbBien = game.players.length - nbMal;
          bonuses.push(`Composition : ${nbBien} 🔵 Frontline / ${nbMal} 🔴 Leadership`);
          if (ROLES[existingPlayer.role]?.camp === 'mal' && influenceur) {
            bonuses.push(`Il semble que ${influenceur.name} soit très impliqué(e) sur LinkedIn récemment.`);
          }
          roleMsg.bonusInfo = bonuses.join('\n\n');
          const allRolesInScript = game.players.map(p => ROLES[p.role]?.name).filter(Boolean);
          const decoyPool = ["L'Inspecteur du Travail", "Le Lanceur d'Alerte", "Le Cabinet de Reclassement", "Le Délégué du Personnel", "L'Agent d'Accueil", "Le Responsable Informatique"];
          const decoysToAdd = decoyPool.filter(r => !allRolesInScript.includes(r)).slice(0, 2);
          const possibleRoles = [...new Set([...allRolesInScript, ...decoysToAdd, 'Le Burn-out'])].sort();
          roleMsg.possibleRoles = possibleRoles;
          send(ws, roleMsg);
        }
        // Resend night prompt if in closing phase
        if (game.phase === 'closingTheDay' && existingPlayer.alive) {
          let effectiveRole = existingPlayer.role;
          if (existingPlayer.role === 'stagiaire' && existingPlayer.inheritedRole) effectiveRole = existingPlayer.inheritedRole;
          if (existingPlayer.fakeRole) effectiveRole = existingPlayer.fakeRole;
          const hasAction = needsNightAction(effectiveRole, game.round);
          const targets = targetCount(effectiveRole);
          const selectablePlayers = game.players
            .filter(p => p.id !== existingPlayer.id)
            .map(p => ({ id: p.id, name: p.name, alive: p.alive }));
          const displayRoleName = existingPlayer.role === 'stagiaire' && existingPlayer.inheritedRole
            ? `Le Stagiaire (→ ${ROLES[existingPlayer.inheritedRole]?.name})`
            : ROLES[existingPlayer.role]?.name || '';
          send(ws, { type: 'nightPrompt', hasAction, targetCount: targets, selectablePlayers, roleName: displayRoleName, role: effectiveRole });
        }
        break;
      }

      case 'startGame': {
        const game = games.get(client.gameCode);
        if (!game || game.hostId !== playerId) break;
        if (game.players.length < 2) { send(ws, { type: 'error', message: "Pas assez de collaborateurs. Min: 2." }); break; }
        game.phase = 'seatingOrder';
        broadcastGameState(game);
        break;
      }

      case 'confirmSeating': {
        const game = games.get(client.gameCode);
        if (!game || game.hostId !== playerId) break;
        // msg.order is an array of player IDs in circle order
        if (msg.order && msg.order.length === game.players.length) {
          const reordered = msg.order.map(id => game.players.find(p => p.id === id)).filter(Boolean);
          game.players = reordered;
        }
        distributeRoles(game);
        game.phase = 'roleReveal';
        broadcastGameState(game);
        broadcastPrivateRoles(game);
        break;
      }

      case 'roleAcknowledged': {
        const game = games.get(client.gameCode);
        if (!game) break;
        const player = game.players.find(p => p.id === playerId);
        if (player) player.roleAcknowledged = true;
        if (game.players.every(p => p.roleAcknowledged)) {
          game.phase = 'closingTheDay';
          game.nightActions = {};
          game.players.forEach(p => { p.nightActionDone = false; });
          broadcastGameState(game);
          broadcastNightPrompts(game);
        }
        break;
      }

      case 'nightAction': {
        const game = games.get(client.gameCode);
        if (!game) break;
        const player = game.players.find(p => p.id === playerId);
        if (!player) break;
        // Use effective role for action storage (Burn-out uses fakeRole, Stagiaire uses inherited)
        let actionRole = player.role;
        if (player.fakeRole) actionRole = player.fakeRole;
        if (player.role === 'stagiaire' && player.inheritedRole) actionRole = player.inheritedRole;

        if (msg.targets && msg.targets.length > 0) {
          // Burn-out: store under a unique key so it doesn't overwrite the real role
          const storageKey = player.fakeRole ? `burnout_${actionRole}` : actionRole;
          game.nightActions[storageKey] = { playerId: player.id, targets: msg.targets, mode: msg.mode || 'default' };
        } else if (actionRole === 'consultant' && msg.mode === 'slides') {
          game.nightActions[actionRole] = { playerId: player.id, targets: [], mode: 'slides' };
        }
        player.nightActionDone = true;

        // Bots auto-act
        triggerBots(game);

        broadcastGameState(game);
        checkAllActed(game);
        break;
      }

      case 'advancePhase': {
        const game = games.get(client.gameCode);
        if (!game || game.hostId !== playerId) break;
        if (game.phase === 'pauseCafe') game.phase = 'tractation';
        else if (game.phase === 'tractation') game.phase = 'meeting';
        broadcastGameState(game);
        break;
      }

      case 'nominate': {
        const game = games.get(client.gameCode);
        if (!game || game.phase !== 'meeting') break;
        const nominator = game.players.find(p => p.id === playerId);
        if (!nominator || !nominator.alive) break;
        const target = game.players.find(p => p.id === msg.targetId);
        if (!target || !target.alive) break;
        if (game.nominations.some(n => n.targetId === msg.targetId)) break;
        game.nominations.push({ targetId: msg.targetId, targetName: target.name, nominatedBy: playerId, votes: 0, voters: [] });
        broadcastGameState(game);
        break;
      }

      case 'vote': {
        const game = games.get(client.gameCode);
        if (!game || game.phase !== 'meeting') break;
        const nomination = game.nominations.find(n => n.targetId === msg.targetId);
        const voter = game.players.find(p => p.id === playerId);
        if (!nomination || !voter) break;
        if (!voter.alive && voter.hasUsedDeadVote) break;
        if (nomination.voters.includes(playerId)) break;
        nomination.voters.push(playerId);
        if (!msg.keep) nomination.votes += 1;
        if (!voter.alive) voter.hasUsedDeadVote = true;
        broadcastGameState(game);
        break;
      }

      case 'classAction': {
        const game = games.get(client.gameCode);
        if (!game || game.phase !== 'meeting') break;
        const journalist = game.players.find(p => p.id === playerId && p.role === 'journaliste');
        if (!journalist) break;
        const target = game.players.find(p => p.id === msg.targetId);
        if (!target) break;

        if (target.role === 'ceo') {
          // CEO found! Frontline wins!
          target.alive = false;
          game.winner = 'frontline';
          game.phase = 'gameEnd';
          game.history.push({ round: game.round, events: [`⚖️ ${journalist.name} (Journaliste) a lancé une Class Action contre ${target.name} — C'ÉTAIT LE CEO ! Victoire de la Frontline !`] });
        } else {
          // Wrong target
          game.history.push({ round: game.round, events: [`⚖️ ${journalist.name} (Journaliste) a lancé une Class Action contre ${target.name} — plainte classée sans suite, ce n'était pas le CEO`] });
        }
        broadcastGameState(game);
        break;
      }

      case 'closeDay': {
        const game = games.get(client.gameCode);
        if (!game || game.hostId !== playerId || game.phase !== 'meeting') break;

        if (game.nominations.length > 0) {
          const sorted = [...game.nominations].sort((a, b) => b.votes - a.votes);
          const top = sorted[0].votes;
          const tied = sorted.filter(n => n.votes === top);
          if (tied.length === 1 && top > 0) {
            game.pendingVoteElimination = sorted[0].targetId;
          }
        }

        game.nominations = [];
        game.phase = 'closingTheDay';
        game.nightActions = {};
        game.players.forEach(p => { p.nightActionDone = false; });
        broadcastGameState(game);
        broadcastNightPrompts(game);
        break;
      }
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.gameCode) {
      const game = games.get(client.gameCode);
      if (game) {
        const player = game.players.find(p => p.id === client.playerId);
        if (player) player.connected = false;
      }
    }
    clients.delete(ws);
  });

  send(ws, { type: 'connected', playerId });
});

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastGameState(game) {
  const publicState = {
    type: 'gameState',
    code: game.code,
    phase: game.phase,
    round: game.round,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      connected: p.connected,
      hasUsedDeadVote: p.hasUsedDeadVote,
      nightActionDone: p.nightActionDone || false,
    })),
    nominations: game.nominations,
    morningMessages: game.morningMessages,
    winner: game.winner,
    deckDeSlides: game.deckDeSlides || null,
  };

  // Include full game log at end of game
  if (game.phase === 'gameEnd') {
    publicState.gameLog = {
      roles: game.players.map(p => ({
        name: p.name,
        role: p.role,
        alive: p.alive,
      })),
      history: game.history,
    };
  }

  for (const [ws, client] of clients) {
    if (client.gameCode === game.code) {
      send(ws, publicState);
    }
  }
}

function broadcastPrivateRoles(game) {
  // Find the influenceur LinkedIn if present
  const influenceur = game.players.find(p => p.role === 'influenceur');

  const leadershipPlayers = game.players.filter(p => ROLES[p.role]?.camp === 'mal');

  for (const [ws, client] of clients) {
    if (client.gameCode === game.code) {
      const player = game.players.find(p => p.id === client.playerId);
      if (player && player.role) {
        // Burn-out sees their fake role
        const displayRole = player.fakeRole || player.role;
        const msg = {
          type: 'yourRole',
          role: displayRole,
          roleName: ROLES[displayRole]?.name || ROLES[player.role].name,
          category: ROLES[displayRole]?.category || ROLES[player.role].category,
          camp: ROLES[displayRole]?.camp || ROLES[player.role].camp,
        };

        // Composition visible to everyone
        const nbMal = leadershipPlayers.length;
        const nbBien = game.players.length - nbMal;
        const bonuses = [];
        bonuses.push(`Composition : ${nbBien} 🔵 Frontline / ${nbMal} 🔴 Leadership`);

        // Leadership-only bonus: Influenceur LinkedIn identity
        if (ROLES[player.role]?.camp === 'mal' && influenceur) {
          bonuses.push(`Il semble que ${influenceur.name} soit très impliqué(e) sur LinkedIn récemment.`);
        }

        msg.bonusInfo = bonuses.join('\n\n');

        // Everyone gets the list of possible roles in this script
        const allRolesInScript = game.players.map(p => ROLES[p.role]?.name).filter(Boolean);
        // Add some decoy roles that are NOT in the game + Burn-out always listed
        const decoyPool = ["L'Inspecteur du Travail", "Le Lanceur d'Alerte", "Le Cabinet de Reclassement", "Le Délégué du Personnel", "L'Agent d'Accueil", "Le Responsable Informatique"];
        const decoysToAdd = decoyPool.filter(r => !allRolesInScript.includes(r)).slice(0, 2);
        const possibleRoles = [...new Set([...allRolesInScript, ...decoysToAdd, 'Le Burn-out'])].sort();
        msg.possibleRoles = possibleRoles;

        send(ws, msg);
      }
    }
  }
}

function broadcastNightPrompts(game) {
  for (const [ws, client] of clients) {
    if (client.gameCode === game.code) {
      const player = game.players.find(p => p.id === client.playerId);
      if (!player || !player.alive) {
        send(ws, { type: 'nightPrompt', hasAction: false, targetCount: 0, selectablePlayers: [] });
        continue;
      }
      // Effective role: Stagiaire uses inherited, Burn-out uses fake
      let effectiveRole = player.role;
      if (player.role === 'stagiaire' && player.inheritedRole) effectiveRole = player.inheritedRole;
      if (player.fakeRole) effectiveRole = player.fakeRole;
      const hasAction = needsNightAction(effectiveRole, game.round);
      const targets = targetCount(effectiveRole);
      const selectablePlayers = game.players
        .filter(p => p.id !== player.id)
        .map(p => ({ id: p.id, name: p.name, alive: p.alive }));

      const displayRoleName = player.role === 'stagiaire' && player.inheritedRole
        ? `Le Stagiaire (→ ${ROLES[player.inheritedRole]?.name})`
        : ROLES[player.role]?.name || '';

      send(ws, {
        type: 'nightPrompt',
        hasAction,
        targetCount: targets,
        selectablePlayers,
        roleName: displayRoleName,
        role: effectiveRole,
      });
    }
  }
}

// ============================================================
// Bot Logic
// ============================================================

function triggerBots(game) {
  const aliveBots = game.players.filter(p => p.isBot && p.alive && !p.nightActionDone);
  for (const bot of aliveBots) {
    const hasAction = needsNightAction(bot.role, game.round);
    if (hasAction) {
      const targets = targetCount(bot.role);
      const selectablePlayers = game.players.filter(p => p.alive && p.id !== bot.id);
      const chosen = selectablePlayers.sort(() => Math.random() - 0.5).slice(0, targets).map(p => p.id);
      if (chosen.length > 0) {
        game.nightActions[bot.role] = { playerId: bot.id, targets: chosen };
      }
    }
    bot.nightActionDone = true;
  }
}

function checkAllActed(game) {
  const alivePlayers = getAlivePlayers(game);
  if (alivePlayers.every(p => p.nightActionDone)) {
    game.round += 1;
    resolveNight(game);
    if (game.phase !== 'gameEnd') {
      game.phase = 'pauseCafe';
    }
    game.players.forEach(p => { p.nightActionDone = false; });
    game.nightActions = {};
    broadcastGameState(game);
    // Send private results to each player
    broadcastPrivateResults(game);
  }
}

function broadcastPrivateResults(game) {
  if (!game.privateResults) return;
  for (const [ws, client] of clients) {
    if (client.gameCode === game.code) {
      const result = game.privateResults[client.playerId];
      if (result) {
        send(ws, { type: 'privateResult', message: result });
      }
    }
  }
  game.privateResults = {};
}

// ============================================================
// Start
// ============================================================

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   LEAST EFFECTIVE — Server v0.1                 ║
║   "Restructuring in progress"                   ║
║                                                  ║
║   🌐 Web app:    http://localhost:${PORT}          ║
║   🔌 WebSocket:  ws://localhost:${PORT}            ║
║                                                  ║
║   Partagez votre IP locale pour jouer           ║
║   entre téléphones sur le même WiFi.            ║
╚══════════════════════════════════════════════════╝
  `);

  // Show local IP for sharing
  const interfaces = require('os').networkInterfaces();
  Object.values(interfaces).flat().filter(i => i.family === 'IPv4' && !i.internal).forEach(i => {
    console.log(`   📱 Sur téléphone: http://${i.address}:${PORT}`);
  });
  console.log('');
});
