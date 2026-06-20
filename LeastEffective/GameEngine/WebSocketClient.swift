import Foundation

@Observable
class WebSocketClient {
    var isConnected = false
    var playerId: String?
    var gameCode: String?
    var errorMessage: String?

    // Public game state (from server)
    var phase: String = "lobby"
    var round: Int = 0
    var players: [ServerPlayer] = []
    var nominations: [ServerNomination] = []
    var morningMessages: [String] = []
    var winner: String?

    // Private state (only for this player)
    var myRole: String?
    var myRoleName: String?
    var myCategory: String?
    var myCamp: String?

    // Night prompt
    var nightHasAction: Bool = false
    var nightTargetCount: Int = 0
    var nightSelectablePlayers: [ServerPlayer] = []
    var nightActionDone: Bool = false

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?

    struct ServerPlayer: Codable, Identifiable {
        let id: String
        let name: String
        let alive: Bool
        let connected: Bool
        let hasUsedDeadVote: Bool
        let nightActionDone: Bool
    }

    struct ServerNomination: Codable, Identifiable {
        let targetId: String
        let targetName: String
        let nominatedBy: String
        let votes: Int
        let voters: [String]
        var id: String { targetId }
    }

    func connect() {
        let url = URL(string: "wss://least-effective.onrender.com")!
        session = URLSession(configuration: .default)
        webSocket = session?.webSocketTask(with: url)
        webSocket?.resume()
        receiveMessage()
    }

    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        isConnected = false
    }

    // MARK: - Send Messages

    func createGame(playerName: String) {
        sendJSON(["type": "createGame", "playerName": playerName])
    }

    func joinGame(code: String, playerName: String) {
        sendJSON(["type": "joinGame", "code": code, "playerName": playerName])
    }

    func startGame() {
        sendJSON(["type": "startGame"])
    }

    func acknowledgeRole() {
        sendJSON(["type": "roleAcknowledged"])
    }

    func submitNightAction(targets: [String]) {
        sendJSON(["type": "nightAction", "targets": targets])
        nightActionDone = true
    }

    func advancePhase() {
        sendJSON(["type": "advancePhase"])
    }

    func nominate(targetId: String) {
        sendJSON(["type": "nominate", "targetId": targetId])
    }

    func vote(targetId: String) {
        sendJSON(["type": "vote", "targetId": targetId])
    }

    func closeDay() {
        sendJSON(["type": "closeDay"])
    }

    // MARK: - Private

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let string = String(data: data, encoding: .utf8) else { return }
        webSocket?.send(.string(string)) { _ in }
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                default: break
                }
                self?.receiveMessage()
            case .failure:
                DispatchQueue.main.async {
                    self?.isConnected = false
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        DispatchQueue.main.async { [self] in
            switch type {
            case "connected":
                self.playerId = json["playerId"] as? String
                self.isConnected = true

            case "gameCreated":
                self.gameCode = json["code"] as? String

            case "gameJoined":
                self.gameCode = json["code"] as? String

            case "error":
                self.errorMessage = json["message"] as? String

            case "gameState":
                self.phase = json["phase"] as? String ?? "lobby"
                self.round = json["round"] as? Int ?? 0
                self.winner = json["winner"] as? String
                self.morningMessages = json["morningMessages"] as? [String] ?? []

                if let playersData = try? JSONSerialization.data(withJSONObject: json["players"] ?? []),
                   let players = try? JSONDecoder().decode([ServerPlayer].self, from: playersData) {
                    self.players = players
                }

                if let nomsData = try? JSONSerialization.data(withJSONObject: json["nominations"] ?? []),
                   let noms = try? JSONDecoder().decode([ServerNomination].self, from: nomsData) {
                    self.nominations = noms
                }

            case "yourRole":
                self.myRole = json["role"] as? String
                self.myRoleName = json["roleName"] as? String
                self.myCategory = json["category"] as? String
                self.myCamp = json["camp"] as? String

            case "nightPrompt":
                self.nightHasAction = json["hasAction"] as? Bool ?? false
                self.nightTargetCount = json["targetCount"] as? Int ?? 0
                self.nightActionDone = false
                if let playersData = try? JSONSerialization.data(withJSONObject: json["selectablePlayers"] ?? []),
                   let sp = try? JSONDecoder().decode([ServerPlayer].self, from: playersData) {
                    self.nightSelectablePlayers = sp
                } else {
                    self.nightSelectablePlayers = []
                }

            default: break
            }
        }
    }
}
