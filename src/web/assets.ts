import {
  ATTENTION_CLAIM_STATUSES,
  UI_CLAIM_FILTERS,
} from "./claimFilters.js";

export const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Escrow · Instruction evidence</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="brand-lockup">
      <strong>Escrow</strong>
      <span aria-hidden="true">/</span>
      <code id="repository-name">Loading…</code>
    </div>
    <div id="overall-status" class="overall-status neutral" aria-live="polite">READY</div>
  </header>

  <main>
    <div class="page-heading">
      <div>
        <h1>Instruction integrity</h1>
        <p>Check whether coding-agent instructions still match this repository.</p>
      </div>
      <button id="scan" class="primary">Scan instructions</button>
    </div>
    <section class="panel controls-panel" aria-labelledby="scan-title">
      <details class="advanced-settings" open>
        <summary id="scan-title">Configuration</summary>
        <div class="advanced-grid">
          <label>Repository<input id="repository" class="path-input" readonly></label>
          <label>Target directory<input id="target" class="path-input"></label>
          <label>Codex model<input id="model"></label>
          <label class="toggle"><input id="execute" type="checkbox"><span><strong>Execute documented commands</strong><small id="execution-safety">Command execution disabled</small></span></label>
          <label class="toggle"><input id="allow-network" type="checkbox"><span><strong>Allow network</strong><small>Explicit opt-in</small></span></label>
        </div>
      </details>
      <p id="message" class="message" role="status" aria-live="polite">Ready to inspect the effective instruction chain.</p>
      <div id="operation-progress" class="operation-progress hidden">
        <div id="scan-progress" class="progress-track" role="progressbar" aria-label="Operation in progress"><span></span></div>
        <div class="progress-copy">
          <span id="elapsed-message" aria-hidden="true"></span>
          <span id="helper-message" aria-hidden="true"></span>
        </div>
      </div>
      <ol id="stages" class="stages" aria-label="Scan stages">
        <li>Discovering instruction files</li><li>Extracting claims</li>
        <li>Validating repository evidence</li><li id="execution-stage">Executing approved commands</li>
        <li>Building report</li>
      </ol>
    </section>

    <section id="results" class="hidden" aria-labelledby="results-title">
      <p id="results-updating" class="results-updating hidden" role="status"></p>
      <div class="section-heading standalone">
        <h2 id="results-title">Results</h2>
        <div class="downloads" aria-label="Download reports">
          <a class="download-button" href="/api/report?format=json" download>Download JSON</a>
          <a class="download-button" href="/api/report?format=markdown" download>Download Markdown</a>
          <a class="download-button" href="/api/report?format=html" download>Download HTML</a>
        </div>
      </div>
      <p id="result-message" class="result-message" role="status"></p>
      <div id="summary" class="summary-grid"></div>

      <div class="two-column">
        <section class="panel" aria-labelledby="chain-title">
          <h3 id="chain-title">Instruction chain</h3>
          <ol id="instruction-chain" class="instruction-chain"></ol>
        </section>
        <section class="panel" aria-labelledby="flow-title">
          <h3 id="flow-title">Trust boundary</h3>
          <div class="trust-flow"><span>Instructions</span><b>→</b><span>Evidence</span><b>→</b><span>Repair</span><b>→</b><span>Verified</span></div>
          <p class="muted">Codex extracts candidate claims. TypeScript validators assign every verdict.</p>
        </section>
      </div>

      <section class="claims-section" aria-labelledby="claims-title">
        <div class="section-heading">
          <h3 id="claims-title">Repository evidence</h3>
          <div id="filters" class="filters" role="group" aria-label="Filter claims"></div>
        </div>
        <div id="claims" class="claim-list"></div>
      </section>
    </section>

    <section id="repair" class="panel repair-panel hidden" aria-labelledby="repair-title">
      <div class="section-heading">
        <h2 id="repair-title">Review instruction patch</h2>
      </div>
      <p class="repair-intro">Generate the smallest truthful documentation patch in an isolated worktree. Preview never changes the active checkout.</p>
      <div class="repair-safety" aria-label="Repair safety boundaries">
        <strong>Preview only</strong><span>Active checkout unchanged</span><span>Verified instruction files only</span>
      </div>
      <button id="preview-repair" class="secondary">Preview instruction repair</button>
      <div id="repair-result" class="hidden">
        <div id="repair-verification" class="verification"></div>
        <div id="repair-totals" class="repair-totals"></div>
        <div class="changed-files-block"><p><strong>Changed files</strong></p><ul id="changed-files"></ul></div>
        <div class="diff-heading"><span>Verified patch</span><code>instruction files only</code></div>
        <pre id="repair-diff" class="diff" tabindex="0" aria-label="Verified instruction repair diff"></pre>
        <div class="apply-box">
          <label class="confirmation"><input id="confirm-apply" type="checkbox"> I understand this will modify only the verified instruction files in the active repository.</label>
          <div class="action-row">
            <button id="revalidate" class="secondary">Revalidate</button>
            <button id="apply-repair" class="danger" disabled>Apply verified repair</button>
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer>Local-only · 127.0.0.1 · No telemetry · No repository persistence</footer>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

export const STYLES_CSS = `
:root{color-scheme:dark;--page:#0d1117;--panel:#161b22;--subtle:#1c2128;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--blue:#2f81f7;--green:#3fb950;--red:#f85149;--amber:#d29922;--focus:#58a6ff;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
*{box-sizing:border-box}html{background:var(--page)}body{margin:0;min-width:320px;background:var(--page);color:var(--text);font:14px/1.5 var(--sans)}button,input,a{font:inherit}button:focus-visible,input:focus-visible,a:focus-visible,summary:focus-visible,pre:focus-visible{outline:2px solid var(--focus);outline-offset:2px}.site-header{min-height:52px;padding:0 max(20px,calc((100vw - 1120px)/2));display:flex;align-items:center;justify-content:space-between;gap:20px;background:var(--page);border-bottom:1px solid var(--border)}.brand-lockup{min-width:0;display:flex;align-items:center;gap:8px}.brand-lockup strong{font-size:15px}.brand-lockup span{color:#6e7681}.brand-lockup code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font:12px var(--mono)}.overall-status{flex:0 0 auto;padding:2px 7px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:11px;font-weight:600}.overall-status.pass{border-color:rgba(63,185,80,.55);color:var(--green)}.overall-status.fail{border-color:rgba(248,81,73,.55);color:var(--red)}.overall-status.warning{border-color:rgba(210,153,34,.55);color:var(--amber)}.overall-status.running{border-color:rgba(47,129,247,.65);color:#79c0ff}.overall-status.error{border-color:rgba(248,81,73,.55);color:var(--red)}
main{max-width:1120px;margin:0 auto;padding:26px 20px 56px}.page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}.page-heading h1{margin:0;font-size:24px;line-height:1.25;letter-spacing:-.015em}.page-heading p{margin:4px 0 0;color:var(--muted)}.panel{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:16px}.section-heading{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:12px}.section-heading.standalone{margin:26px 0 12px}.section-heading h2,.section-heading h3,.panel h3{margin:0;font-size:16px;line-height:1.35}.primary,.secondary,.danger{min-height:34px;border-radius:5px;padding:6px 12px;font-weight:600;cursor:pointer}.primary{border:1px solid #1f6feb;background:var(--blue);color:#fff}.primary:hover{background:#388bfd}.secondary{border:1px solid #484f58;background:#21262d;color:var(--text)}.secondary:hover,.download-button:hover{border-color:#8b949e;background:var(--subtle)}.danger{border:1px solid rgba(248,81,73,.7);background:#da3633;color:#fff}.danger:hover:not(:disabled){background:var(--red)}.danger:disabled,button:disabled{opacity:.48;cursor:not-allowed}
.controls-panel{padding:0}.advanced-settings>summary{padding:11px 14px;color:#c9d1d9;font-weight:600;cursor:pointer}.advanced-settings[open]>summary{border-bottom:1px solid var(--border)}.advanced-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px 16px;padding:14px}.advanced-grid label{display:flex;min-width:0;flex-direction:column;gap:5px;color:var(--muted);font-size:12px}.advanced-grid input{width:100%;min-width:0;border:1px solid var(--border);border-radius:5px;background:var(--page);padding:7px 9px;color:var(--text)}.advanced-grid input:hover{border-color:#484f58}.advanced-grid input:focus{border-color:var(--blue)}.advanced-grid input[readonly]{background:var(--subtle);color:#b1bac4}.advanced-grid .path-input{font-family:var(--mono)}.toggle{align-self:end;flex-direction:row!important;align-items:center;gap:8px!important;min-height:34px;color:var(--text)!important}.toggle>span{display:grid}.toggle strong{font-size:12px;font-weight:500}.toggle small{color:var(--muted);font-size:11px}.toggle input{flex:0 0 auto;width:15px!important;height:15px;accent-color:var(--blue)}.message{margin:0;padding:9px 14px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}.stages{display:flex;flex-wrap:wrap;gap:0;padding:8px 14px;margin:0;border-top:1px solid var(--border);list-style:none}.stages li{display:flex;align-items:center;color:var(--muted);font-size:11px}.stages li:before{content:'○';margin-right:5px;color:#6e7681}.stages li:not(:last-child):after{content:'›';margin:0 10px;color:#484f58}.stages li.running{color:#79c0ff}.stages li.running:before{content:'●';color:var(--blue)}.stages li.done{color:var(--green)}.stages li.done:before{content:'✓';color:var(--green)}.stages li.skipped{opacity:.5}.stages li.skipped:before{content:'—'}
#scan{min-width:126px}#preview-repair{min-width:190px}.button-loading{display:inline-flex;align-items:center;justify-content:center;gap:7px}.spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.35);border-top-color:currentColor;border-radius:50%;animation:spin .75s linear infinite}.secondary .spinner{border-color:rgba(230,237,243,.3);border-top-color:currentColor}.operation-progress{padding:8px 14px 9px;border-top:1px solid var(--border)}.progress-track{height:2px;overflow:hidden;background:#21262d}.progress-track span{display:block;width:18%;height:100%;background:var(--blue);animation:indeterminate 1.35s ease-in-out infinite}.progress-copy{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;margin-top:6px;color:var(--muted);font-size:11px}.progress-copy span:first-child{color:#c9d1d9}.stages.active{position:relative;overflow:hidden}.stages.active:before{content:'';position:absolute;top:0;left:0;width:48px;height:1px;background:var(--blue);animation:pipeline-active 1.8s linear infinite}.stages li.queued:before{content:'○';color:#6e7681}.stages li.interrupted{color:var(--red)}.stages li.interrupted:before{content:'!';color:var(--red)}.results-updating{margin:18px 0 -16px;color:#79c0ff;font-size:12px}.results-updating.error{color:#ffa198}.results-stale{opacity:.62}.results-stale .downloads{pointer-events:none}
.hidden{display:none!important}.downloads{display:flex;flex-wrap:wrap;gap:4px}.download-button{display:inline-flex;align-items:center;min-height:29px;border:1px solid var(--border);border-radius:5px;background:var(--panel);color:#c9d1d9;padding:4px 8px;font-size:11px;font-weight:600;text-decoration:none}.result-message{margin:0 0 10px;padding:9px 11px;border:1px solid var(--border);border-left-width:3px;border-radius:4px;background:var(--panel);font-weight:600}.result-message.fail{border-left-color:var(--red);color:#ffa198}.result-message.pass{border-left-color:var(--green);color:#7ee787}.summary-grid{display:flex;flex-wrap:wrap;align-items:center;gap:0;padding:7px 0;color:var(--muted)}.summary-card{display:inline-flex;align-items:baseline;gap:4px}.summary-card:not(:last-child):after{content:'·';margin:0 9px;color:#484f58}.summary-card strong{font-size:13px;color:var(--text)}.summary-card span{font-size:12px}.summary-card.failed strong{color:var(--red)}.summary-card.warnings strong,.summary-card.blocked strong,.summary-card.inconclusive strong{color:var(--amber)}.summary-card.passed strong{color:var(--green)}.two-column{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.two-column .panel{padding:12px;background:transparent}.instruction-chain{margin:8px 0 0;padding-left:20px}.instruction-chain li{padding:3px 0}.instruction-chain code{color:#79c0ff;font:12px var(--mono);overflow-wrap:anywhere}.scope-note{display:block;color:var(--muted);font-size:11px}.trust-flow{display:flex;align-items:center;gap:7px;margin:8px 0;color:#c9d1d9;font-size:12px}.trust-flow b{color:#484f58}.muted{color:var(--muted)}
.claims-section{margin-top:18px}.filters{display:flex;flex-wrap:wrap;gap:4px}.filters button{border:1px solid var(--border);background:transparent;border-radius:5px;padding:4px 8px;color:var(--muted);font-size:11px;cursor:pointer}.filters button:hover{color:var(--text);border-color:#484f58}.filters button.active{color:#79c0ff;border-color:var(--blue);background:rgba(47,129,247,.08)}.claim-list{border-top:1px solid var(--border)}.claim-card{border:0;border-bottom:1px solid var(--border);border-left:3px solid #484f58;border-radius:0;background:transparent}.claim-card.status-failed{border-left-color:var(--red)}.claim-card.status-warning,.claim-card.status-blocked,.claim-card.status-inconclusive{border-left-color:var(--amber)}.claim-card.status-passed{border-left-color:var(--green)}.claim-card summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 11px;cursor:pointer;list-style:none}.claim-card summary::-webkit-details-marker{display:none}.status-badge{border:1px solid currentColor;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:600}.status-badge.status-passed{color:var(--green)}.status-badge.status-failed{color:var(--red)}.status-badge.status-warning,.status-badge.status-blocked,.status-badge.status-inconclusive{color:var(--amber)}.status-badge.status-advisory,.status-badge.status-overridden{color:var(--muted)}.claim-type{font-weight:600}.claim-source{color:#79c0ff;font:11px var(--mono);text-align:right;overflow-wrap:anywhere}.claim-body{border-top:1px solid var(--border);padding:12px 14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px;background:#11161d}.claim-body>*{min-width:0}.claim-body>div:nth-child(n+3){grid-column:1/-1}.claim-body h4{margin:0 0 4px;color:var(--muted);font-size:11px;font-weight:600}.claim-body p,.claim-body ul{margin:0}.instruction-quote{color:#f0f6fc;font:12px/1.5 var(--mono);white-space:pre-wrap}.evidence-list{padding-left:18px;color:#d0d7de;font:12px/1.55 var(--mono)}.evidence-list li{margin:3px 0}.command-output,.diff{max-width:100%;white-space:pre;word-break:normal;background:#010409;color:#c9d1d9;border:1px solid var(--border);border-radius:4px;padding:12px;overflow:auto;font:11px/1.55 var(--mono)}
.repair-panel{margin-top:22px}.repair-intro{max-width:760px;margin:0 0 10px;color:var(--muted)}.repair-safety{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 12px;color:var(--muted);font-size:12px}.repair-safety strong{color:var(--text)}.verification{margin:14px 0 8px;padding:8px 10px;border-left:3px solid var(--green);background:#11161d;color:#7ee787;font-weight:600}.repair-totals{display:flex;gap:0;border:1px solid var(--border);border-radius:4px}.repair-totals div{flex:1;padding:8px 10px}.repair-totals div+div{border-left:1px solid var(--border)}.repair-totals strong{font-size:11px;color:var(--muted)}.repair-totals p{margin:3px 0 0}.changed-files-block{display:flex;align-items:flex-start;gap:14px;margin:12px 0}.changed-files-block p{margin:0;color:var(--muted);font-size:11px}.changed-files-block ul{margin:0;padding-left:18px;font:12px var(--mono)}.diff-heading{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border);border-bottom:0;border-radius:4px 4px 0 0;background:var(--subtle);padding:6px 9px;font-size:11px;font-weight:600}.diff-heading code{color:var(--green);font-family:var(--mono)}.diff{margin:0;border-radius:0 0 4px 4px;max-height:420px}.apply-box{border-top:1px solid var(--border);margin-top:14px;padding-top:12px}.confirmation{display:flex;gap:8px;align-items:flex-start;color:#c9d1d9;font-size:12px}.confirmation input{margin-top:3px;accent-color:var(--red)}.action-row{display:flex;align-items:center;gap:8px;margin-top:12px}footer{max-width:1120px;margin:0 auto;border-top:1px solid var(--border);padding:16px 20px 26px;color:var(--muted);text-align:center;font-size:11px}
@media(max-width:860px){.advanced-grid{grid-template-columns:1fr 1fr}.summary-grid{padding-bottom:2px}.two-column{grid-template-columns:1fr}}
@media(max-width:640px){.site-header{padding-inline:14px}.brand-lockup code{max-width:52vw}main{padding:20px 14px 44px}.page-heading{align-items:stretch;flex-direction:column;gap:12px}.page-heading .primary{align-self:flex-start}.advanced-grid{grid-template-columns:1fr}.section-heading{align-items:flex-start;flex-direction:column}.stages{display:grid;gap:4px}.stages li:not(:last-child):after{display:none}.downloads{justify-content:flex-start}.claim-card summary{grid-template-columns:auto 1fr}.claim-source{grid-column:1/-1;text-align:left}.claim-body{grid-template-columns:1fr}.claim-body>div{grid-column:1!important}.repair-totals{display:block}.repair-totals div+div{border-top:1px solid var(--border);border-left:0}.diff-heading{align-items:flex-start;gap:4px;flex-direction:column}}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes indeterminate{0%{transform:translateX(-110%)}55%{transform:translateX(280%)}100%{transform:translateX(570%)}}@keyframes pipeline-active{from{transform:translateX(-48px)}to{transform:translateX(1120px)}}
@media(prefers-reduced-motion:reduce){.spinner,.progress-track span,.stages.active:before{animation:none}.progress-track span{width:24px;opacity:.7}.stages.active:before{display:none}}
`;

export const APP_JAVASCRIPT = `
const state={config:null,report:null,preview:null,filter:'attention',scanBusy:false,repairBusy:false,operationTimer:null,operationStartedAt:0,previousOverall:null};
const $=(id)=>document.getElementById(id);
const el=(name,className,text)=>{const node=document.createElement(name);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node};
const labels={passed:'Passed',failed:'Failed',warnings:'Warnings',blocked:'Blocked',inconclusive:'Inconclusive',advisory:'Advisory',overridden:'Overridden'};
const filters=${JSON.stringify(UI_CLAIM_FILTERS)};
const attentionStatuses=new Set(${JSON.stringify(ATTENTION_CLAIM_STATUSES)});

async function api(path,options={}){const response=await fetch(path,options);const type=response.headers.get('content-type')||'';const body=type.includes('application/json')?await response.json():await response.text();if(!response.ok)throw new Error(body.error||body||('Request failed: '+response.status));return body}
function requestOptions(){return{target:$('target').value,model:$('model').value,execute:$('execute').checked,allowNetwork:$('allow-network').checked,timeout:state.config.timeout}}
function setBusy(busy,message){$('scan').disabled=busy;$('preview-repair').disabled=busy;$('message').textContent=message;document.body.setAttribute('aria-busy',String(busy))}
function setButtonLoading(id,loading,label){const button=$(id);if(!loading){button.textContent=id==='scan'?'Scan instructions':'Preview instruction repair';return}const content=el('span','button-loading');const spinner=el('span','spinner');spinner.setAttribute('aria-hidden','true');content.append(spinner,document.createTextNode(label));button.replaceChildren(content)}
function updateStages(mode){const root=$('stages');const items=[...root.children];root.classList.toggle('active',mode==='active');items.forEach(item=>{item.className=mode==='active'?'queued':mode==='complete'?'done':mode==='interrupted'?'interrupted':''});if(mode==='complete'&&!$('execute').checked)items[3].className='skipped'}
function updateOperationCopy(kind){const seconds=Math.max(0,Math.floor((Date.now()-state.operationStartedAt)/1000));$('elapsed-message').textContent=(kind==='scan'?'Scanning repository… ':'Generating and verifying repair… ')+seconds+'s';if(kind!=='scan')return;$('helper-message').textContent=seconds>=20?'Still working. Results will appear automatically.':seconds>=10?'Live extraction may take 10–20 seconds.':seconds>=5?'Extracting structured claims with GPT-5.6…':'Scanning repository instructions…'}
function beginOperation(kind){state.operationStartedAt=Date.now();$('operation-progress').classList.remove('hidden');$('scan-progress').setAttribute('aria-label',kind==='scan'?'Repository scan in progress':'Repair preview in progress');$('helper-message').textContent=kind==='scan'?'Scanning repository instructions…':'Generating and verifying an instruction-only repair.';updateOperationCopy(kind);state.operationTimer=setInterval(()=>updateOperationCopy(kind),1000);document.body.setAttribute('aria-busy','true');$('scan').disabled=true;$('preview-repair').disabled=true;setButtonLoading(kind==='scan'?'scan':'preview-repair',true,kind==='scan'?'Scanning…':'Generating and verifying repair…')}
function endOperation(kind){if(state.operationTimer!==null){clearInterval(state.operationTimer);state.operationTimer=null}$('operation-progress').classList.add('hidden');$('elapsed-message').textContent='';$('helper-message').textContent='';document.body.setAttribute('aria-busy','false');setButtonLoading(kind==='scan'?'scan':'preview-repair',false);$('scan').disabled=false;$('preview-repair').disabled=false}
function markResultsUpdating(){if(state.report===null)return;const results=$('results');results.classList.add('results-stale');results.setAttribute('aria-busy','true');const notice=$('results-updating');notice.textContent='Updating results…';notice.className='results-updating'}
function finishResultsUpdating(failed){const results=$('results');results.classList.remove('results-stale');results.removeAttribute('aria-busy');const notice=$('results-updating');if(failed&&state.report!==null){notice.textContent='Refresh failed. Showing the previous verified results.';notice.className='results-updating error'}else{notice.textContent='';notice.className='results-updating hidden'}}
function setOverallRunning(){const overall=$('overall-status');state.previousOverall={text:overall.textContent,className:overall.className};overall.textContent='RUNNING';overall.className='overall-status running'}
function restoreOverallAfterError(){const overall=$('overall-status');if(state.report!==null&&state.previousOverall!==null){overall.textContent=state.previousOverall.text;overall.className=state.previousOverall.className}else{overall.textContent='ERROR';overall.className='overall-status error'}}
function displayConfigurationRepository(path){if(typeof path!=='string')return'';const parts=path.replaceAll('\\\\','/').replace(/\\/+$/,'').split('/').filter(Boolean);return parts.at(-1)||'.'}
function displayConfigurationTarget(path){const root=state.config?.repository;if(!root||typeof path!=='string')return'.';const normalizedRoot=root.replaceAll('\\\\','/').replace(/\\/+$/,'');const normalizedPath=path.replaceAll('\\\\','/').replace(/\\/+$/,'');if(normalizedPath===normalizedRoot)return'.';if(normalizedPath.startsWith(normalizedRoot+'/'))return normalizedPath.slice(normalizedRoot.length+1);return'[outside repository]'}
function redactHomePath(value){return value.replace(/(?:[A-Za-z]:)?\\/(?:Users|home)\\/[^/\\s"']+/gu,'~')}
function displayRepositoryPath(path){const root=state.report?.repositoryRoot||state.config?.repository;if(!root||typeof path!=='string')return path;const normalizedRoot=root.replaceAll('\\\\','/').replace(/\\/+$/,'');const normalizedPath=path.replaceAll('\\\\','/');if(normalizedPath===normalizedRoot)return'.';const prefix=normalizedRoot+'/';if(normalizedPath.startsWith(prefix))return normalizedPath.slice(prefix.length);if(normalizedPath.startsWith('/')||normalizedPath==='..'||normalizedPath.startsWith('../'))return'[outside repository]';return normalizedPath}
function displayRepositoryEvidence(value){const root=state.report?.repositoryRoot||state.config?.repository;if(!root||typeof value!=='string')return value;const normalizedRoot=root.replaceAll('\\\\','/').replace(/\\/+$/,'');const text=value.replaceAll('\\\\','/');const displayed=text.replaceAll(normalizedRoot+'/','');if(displayed===normalizedRoot)return'.';return redactHomePath(displayed.replaceAll('"'+normalizedRoot+'"','"."'))}
function sourceLocation(claim){return displayRepositoryPath(claim.sourceFile)+':'+claim.lineStart+(claim.lineEnd===claim.lineStart?'':'-'+claim.lineEnd)}
function statusFilter(status){return status==='warning'?'warnings':status}
function claimMatchesFilter(claim){if(state.filter==='all')return true;if(state.filter==='attention')return attentionStatuses.has(claim.status);return statusFilter(claim.status)===state.filter}

function renderSummary(report){const root=$('summary');root.replaceChildren();Object.entries(labels).forEach(([key,label])=>{const card=el('div','summary-card '+key);card.append(el('strong','',report.summary[key]),el('span','',label));root.append(card)});const overall=$('overall-status');overall.textContent=report.overallStatus==='pass_with_warnings'?'PASS WITH WARNINGS':report.overallStatus.toUpperCase();overall.className='overall-status '+(report.overallStatus==='pass'?'pass':report.overallStatus==='fail'?'fail':'warning')}
function renderChain(report){const root=$('instruction-chain');root.replaceChildren();report.instructionChain.forEach((file,index)=>{const item=el('li');item.append(el('code','',displayRepositoryPath(file.path)),el('span','scope-note',index===0?'Broadest instruction':'More specific · scope '+displayRepositoryPath(file.directory)));root.append(item)});if(report.instructionChain.length===0)root.append(el('li','muted','No non-empty instruction files discovered.'))}
function renderFilters(){const root=$('filters');root.replaceChildren();filters.forEach(filter=>{const button=el('button',state.filter===filter.name?'active':'',filter.label);button.type='button';button.setAttribute('aria-pressed',String(state.filter===filter.name));button.onclick=()=>{state.filter=filter.name;renderFilters();renderClaims()};root.append(button)})}
function addField(root,title,value,className){if(value===undefined||value===null||value==='')return;const box=el('div');box.append(el('h4','',title),el('p',className||'',value));root.append(box)}
function renderClaims(){const root=$('claims');root.replaceChildren();const claims=state.report?.claims||[];claims.filter(claimMatchesFilter).forEach(claim=>{const card=el('details','claim-card status-'+claim.status);if(claim.status==='failed')card.open=true;const head=el('summary');head.append(el('span','status-badge status-'+claim.status,claim.status),el('span','claim-type',claim.type.replaceAll('_',' ')),el('span','claim-source',sourceLocation(claim)));const body=el('div','claim-body');addField(body,'Original instruction',claim.originalText,'instruction-quote');addField(body,'Normalized claim',claim.normalizedValue);const evidence=el('div');evidence.append(el('h4','','Deterministic evidence'));const list=el('ul','evidence-list');claim.evidence.forEach(item=>list.append(el('li','',displayRepositoryEvidence(item))));evidence.append(list);body.append(evidence);addField(body,'Suggestion',claim.suggestion);if(claim.commandResult){const output='Command: '+claim.commandResult.command+'\\nWorking directory: '+displayRepositoryPath(claim.commandResult.workingDirectory)+'\\nExit code: '+claim.commandResult.exitCode+'\\nDuration: '+claim.commandResult.durationMs+'ms\\n\\nSTDOUT\\n'+claim.commandResult.stdout+'\\n\\nSTDERR\\n'+claim.commandResult.stderr;addField(body,'Command output',output,'command-output')}card.append(head,body);root.append(card)});if(root.children.length===0)root.append(el('p','muted','No claims match this filter.'))}
function renderReport(report,options={}){state.report=report;state.filter=report.claims.some(claim=>attentionStatuses.has(claim.status))?'attention':'passed';$('results').classList.remove('hidden');const resultMessage=$('result-message');resultMessage.textContent=report.summary.failed>0?'These instructions do not match the repository.':'No broken instructions were found.';resultMessage.className='result-message '+(report.summary.failed>0?'fail':'pass');renderSummary(report);renderChain(report);renderFilters();renderClaims();$('repair').classList.toggle('hidden',report.summary.failed===0&&!state.preview);if(!options.preservePreview){$('repair-result').classList.add('hidden');state.preview=null;$('confirm-apply').checked=false;$('apply-repair').disabled=true}}

async function scan(){if(state.scanBusy||state.repairBusy)return;state.scanBusy=true;setOverallRunning();markResultsUpdating();beginOperation('scan');$('message').textContent='Scanning repository instructions…';updateStages('active');try{const report=await api('/api/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(requestOptions())});finishResultsUpdating(false);renderReport(report);updateStages('complete');$('message').textContent='Scan complete. Every status below comes from deterministic validation.'}catch(error){finishResultsUpdating(true);restoreOverallAfterError();$('message').textContent='Scan failed: '+error.message;updateStages('interrupted')}finally{state.scanBusy=false;endOperation('scan')}}
function totalsText(report){return report.summary.passed+' passed · '+report.summary.failed+' failed · '+report.summary.warnings+' warnings · '+report.summary.inconclusive+' inconclusive'}
function displayRepairPatch(patch){const root=state.config?.repository?.replaceAll('\\\\','/').replace(/\\/+$/,'');return root?patch.replaceAll(root+'/',''):patch}
async function previewRepair(){if(state.repairBusy||state.scanBusy)return;state.repairBusy=true;beginOperation('repair');$('message').textContent='Generating and verifying an instruction-only repair…';try{const preview=await api('/api/fix/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(requestOptions())});state.preview=preview;$('repair-result').classList.remove('hidden');$('repair-verification').textContent=preview.verified?'Verified: repair reduced failures without introducing new failures.':'No verified repair was produced.';$('repair-diff').textContent=preview.patch?displayRepairPatch(preview.patch):'No patch.';const changed=$('changed-files');changed.replaceChildren();preview.changedFiles.forEach(file=>changed.append(el('li','',displayRepositoryPath(file))));const totals=$('repair-totals');totals.replaceChildren();const before=el('div');before.append(el('strong','','Before'),el('p','',totalsText(preview.beforeReport)));const after=el('div');after.append(el('strong','','After'),el('p','',preview.afterReport?totalsText(preview.afterReport):'Not available'));totals.append(before,after);$('apply-repair').disabled=!preview.verified||!$('confirm-apply').checked;$('message').textContent=preview.verified?'Repair preview verified. The active checkout is unchanged.':'No repair was needed or verified.'}catch(error){$('message').textContent='Repair preview rejected: '+error.message}finally{state.repairBusy=false;endOperation('repair')}}
function revalidatePreview(){if(!state.preview?.verified||!state.preview.afterReport){$('message').textContent='No verified preview is available to revalidate.';return}renderReport(state.preview.afterReport,{preservePreview:true});$('repair').classList.remove('hidden');$('repair-result').classList.remove('hidden');$('message').textContent='Verified repair revalidated in the isolated worktree. The active checkout is unchanged.'}
async function applyRepair(){if(!state.preview?.verified||!$('confirm-apply').checked)return;setBusy(true,'Applying the exact verified instruction patch…');try{await api('/api/fix/apply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({previewId:state.preview.previewId,confirmation:'APPLY_VERIFIED_REPAIR'})});state.preview=null;$('message').textContent='Verified repair applied. Scan again to build fresh evidence.';$('apply-repair').disabled=true;$('confirm-apply').checked=false}catch(error){$('message').textContent='Repair was not applied: '+error.message}finally{setBusy(false,$('message').textContent)}}
function updateExecutionSafety(){const enabled=$('execute').checked;$('execution-safety').textContent=enabled?'Commands run in isolated worktrees':'Command execution disabled';$('execution-stage').classList.toggle('skipped',!enabled)}
async function load(){try{state.config=await api('/api/config');const repositoryLabel=displayConfigurationRepository(state.config.repository);$('repository').value=repositoryLabel;$('target').value=displayConfigurationTarget(state.config.target);$('model').value=state.config.model;$('execute').checked=state.config.execute;$('allow-network').checked=state.config.allowNetwork;$('repository-name').textContent=repositoryLabel;updateExecutionSafety()}catch(error){$('message').textContent='Unable to load local configuration: '+error.message}}
$('scan').onclick=scan;$('preview-repair').onclick=previewRepair;$('revalidate').onclick=revalidatePreview;$('apply-repair').onclick=applyRepair;$('confirm-apply').onchange=()=>{$('apply-repair').disabled=!(state.preview?.verified&&$('confirm-apply').checked)};$('execute').onchange=updateExecutionSafety;load();
`;
