import SwiftUI
import WebKit
import UniformTypeIdentifiers

@MainActor final class Writer: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    static let shared = Writer()
    let web = WKWebView()
    private let service = Process()
    private let input = Pipe()
    private var origin: URL?
    @Published var status = "正在打开仿写编辑器…"

    override init() {
        super.init()
        web.navigationDelegate = self
        web.uiDelegate = self
    }

    func start() async {
        guard !service.isRunning else { return }
        let resources = Bundle.main.resourceURL!
        let output = Pipe()
        service.executableURL = resources.appendingPathComponent("python/bin/python3.11")
        service.arguments = ["-I", "-B", resources.appendingPathComponent("writer/writer.py").path, "--app-bundle"]
        service.standardInput = input
        service.standardOutput = output
        do {
            try service.run()
            let data = await Task.detached { output.fileHandleForReading.availableData }.value
            let line = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
            guard let url = URL(string: line), url.scheme == "http", url.host == "127.0.0.1", url.port != nil else {
                status = "无法启动本机服务。请退出应用，并从安装包重新复制后打开。"; return
            }
            origin = url
            web.load(URLRequest(url: url))
        } catch { status = "无法启动仿写编辑器。" + error.localizedDescription }
    }
    func stop() { try? input.fileHandleForWriting.close() }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { status = "" }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload && url.scheme == "blob" { decisionHandler(.download); return }
        let local = url.scheme == "http" && url.host == "127.0.0.1" && url.port == origin?.port
        decisionHandler(local ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = ["docx","md","txt"].compactMap { UTType(filenameExtension: $0) }
        completionHandler(panel.runModal() == .OK ? panel.urls : nil)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let panel = NSAlert()
        panel.messageText = message
        panel.addButton(withTitle: "继续"); panel.addButton(withTitle: "取消")
        completionHandler(panel.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        completionHandler(panel.runModal() == .OK ? panel.url : nil)
    }
}

struct Browser: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { Writer.shared.web }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
@MainActor final class Delegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { Writer.shared.stop() }
}
struct Editor: View {
    @ObservedObject var writer = Writer.shared
    var body: some View {
        ZStack {
            Browser()
            if !writer.status.isEmpty { Text(writer.status).padding().textSelection(.enabled) }
        }.frame(minWidth: 560, minHeight: 460).task { await writer.start() }
    }
}
@main struct WriterApp: App {
    @NSApplicationDelegateAdaptor(Delegate.self) var delegate
    var body: some Scene {
        Window("致知文章仿写", id: "writer") { Editor() }.defaultSize(width: 1100, height: 760)
    }
}
