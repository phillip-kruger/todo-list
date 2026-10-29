// todo-list's tab on Elf Desk: your todos, soonest delivery date first, with Ask AI and Create issue on each.
// It runs in the desk's sandboxed frame: everything goes through `elf`, and only what elf.yaml declares.
import {
    LitElement, html, css, shared, cardStyles, markdown, markdownStyles, spinner, ago, runTime, count, settingsButton,
    Ticking, elf,
} from '/elf-kit/1/kit.js';

/** Today as yyyy-mm-dd, in local time: delivery dates are days, not instants. */
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    const t = new Date(y, m - 1, d + n);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** "Mon 3 Nov" for a yyyy-mm-dd. */
function dayText(day) {
    const [y, m, d] = day.split('-').map(Number);
    const t = new Date(y, m - 1, d);
    return t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short',
        ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

/** overdue, today, soon or '' for an open todo. */
function dueState(t, soonDays) {
    if (!t.due || t.done) return '';
    const now = today();
    if (t.due < now) return 'overdue';
    if (t.due === now) return 'today';
    return t.due <= addDays(now, soonDays) ? 'soon' : '';
}

/** Open ones soonest delivery date first, then the ones with no date, oldest first. */
function sortOpen(todos) {
    return todos.filter(t => !t.done).sort((a, b) =>
        (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1
            : (a.created ?? '').localeCompare(b.created ?? ''));
}

async function loadTodos() {
    return (await elf.readJson('todos', 'todos.json').catch(() => null)) ?? { todos: [] };
}

async function soonDays() {
    const n = parseInt((await elf.values().catch(() => ({})))?.DUE_SOON_DAYS, 10);
    return Number.isNaN(n) ? 2 : n;
}

const SIZE = { small: 'Small', medium: 'Medium', large: 'Large', 'very large': 'Very large' };
const MODE = { investigate: 'Investigate', opinion: 'Opinion' };

class TodoListTab extends LitElement {

    static properties = {
        _list: { state: true },
        _repos: { state: true },
        _soon: { state: true },
        _loading: { state: true },
        _error: { state: true },
        _form: { state: true },
        _editing: { state: true },
        _ask: { state: true },
        _issue: { state: true },
        _link: { state: true },
        _steps: { state: true },
        _stepEdit: { state: true },
        _agents: { state: true },
        _busy: { state: true },
    };

    static styles = [shared, markdownStyles, css`
        .page { display: grid; gap: 26px; }
        h1 { font-size: 34px; line-height: 1.15; font-weight: 600; letter-spacing: -0.022em; }
        h2 { font-size: 18px; font-weight: 600; margin: 0; }
        .sub { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
        form { display: grid; gap: 12px; padding: 18px 22px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
        input, textarea, select { font: inherit; color: var(--ink); }
        /* The desk's shared styles leave text fields to the browser, so give them the desk's look here. */
        input:not([type="checkbox"]):not([type="radio"]), textarea, select {
            box-sizing: border-box; width: 100%; min-width: 0; padding: 8px 11px; font-size: 14px;
            background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-control, 9px);
            color-scheme: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
        input:not([type="checkbox"]):not([type="radio"]):hover, textarea:hover, select:hover { border-color: var(--muted); }
        input:not([type="checkbox"]):not([type="radio"]):focus, textarea:focus, select:focus {
            outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        input:disabled, textarea:disabled, select:disabled { opacity: 0.6; cursor: not-allowed; }
        input::placeholder, textarea::placeholder { color: var(--muted); opacity: 0.8; }
        input[type="checkbox"], input[type="radio"] { accent-color: var(--accent); }
        textarea { min-height: 5em; resize: vertical; line-height: 1.5; }
        textarea.body { min-height: 14em; }
        .buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        li { padding: 14px 18px; display: grid; gap: 8px; }
        li.overdue { border-left: 4px solid var(--danger, #c0392b); }
        li.today { border-left: 4px solid var(--warn, #d68910); }
        li.done { opacity: 0.65; }
        li.done .what { text-decoration: line-through; }
        .what { font-weight: 600; color: var(--ink); }
        .meta { font-size: 13px; color: var(--muted); display: flex; gap: 6px 14px; flex-wrap: wrap; }
        .flag { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
        .flag.overdue { background: var(--danger-soft, #fde2df); color: var(--danger, #c0392b); }
        .flag.today { background: var(--warn-soft, #fdf0d5); color: var(--warn, #9a6200); }
        .flag.soon, .flag.closed { background: var(--soft, #eef0f3); color: var(--muted); }
        .desc { font-size: 14px; }
        .box { border-top: 1px solid var(--line, #e3e5e8); padding-top: 10px; display: grid; gap: 10px; }
        .report { font-size: 14px; display: grid; gap: 6px; }
        .report h3 { font-size: 14px; margin: 6px 0 0; }
        .report ul { gap: 4px; list-style: disc; padding-left: 20px; }
        .report li { padding: 0; display: list-item; }
        .report code { font-size: 13px; }
        .modes { display: flex; gap: 14px; }
        .modes label { display: flex; gap: 6px; align-items: center; color: var(--ink); font-size: 14px; }
        .issues { display: grid; gap: 4px; font-size: 14px; }
        .issue { display: inline-flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
        button.link { background: none; border: none; padding: 0; color: var(--muted); font-size: 13px; cursor: pointer; text-decoration: underline; }
        ul.steps { gap: 6px; }
        ul.steps > li { padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: baseline; }
        ul.steps > li > .box { grid-column: 1 / -1; }
        .step { display: flex; gap: 8px; align-items: baseline; color: var(--ink); font-size: 14px; }
        .step.ticked { color: var(--muted); text-decoration: line-through; }
        .step-edit { display: flex; gap: 8px; padding: 0; grid-column: 1 / -1; }
        .step-edit input { flex: 1; }
        .empty { color: var(--muted); padding: 18px; margin: 0; }
        details.done-list > summary { cursor: pointer; font-weight: 600; margin-bottom: 10px; }
        .skeleton.big { height: 30vh; }
        .top-buttons { display: flex; gap: 8px; align-items: center; }
        /* Add todo is a pop-up, so the list keeps the whole page. */
        dialog.add { width: min(640px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; color: var(--ink);
            background: var(--surface, #fff); border: 1px solid var(--line); border-radius: 14px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25); }
        dialog.add::backdrop { background: rgba(0, 0, 0, 0.35); }
        dialog.add form { padding: 20px 22px; }
    `];

    constructor() {
        super();
        new Ticking(this);
        this._loading = true;
        this._form = { what: '', who: '', description: '', due: '' };
        this._agents = {};
        this._steps = {};
        this._soon = 2;
        this._repos = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
        // A run started or ended, the list changed, or an agent said something: read again.
        this._off = elf.onChange(() => this._load());
    }

    disconnectedCallback() {
        this._off?.();
        super.disconnectedCallback();
    }

    async _load() {
        this._error = null;
        try {
            this._list = await loadTodos();
            const values = await elf.values().catch(() => ({}));
            this._repos = (values.REPOS ?? '').split(',').map(r => r.trim()).filter(Boolean);
            const n = parseInt(values.DUE_SOON_DAYS, 10);
            this._soon = Number.isNaN(n) ? 2 : n;
            // Agents still running when the list was saved: their live state, until the elf keeps their report.
            const agents = {};
            for (const t of this._list.todos ?? []) {
                for (const r of t.reports ?? []) {
                    if (r.status === 'running' && r.agent) agents[r.agent] = await elf.agent(r.agent).catch(() => null);
                }
            }
            this._agents = agents;
        } catch (e) {
            this._error = e.message;
        } finally {
            this._loading = false;
        }
    }

    async _act(action, params, failed) {
        try {
            return await elf.act(action, params);
        } catch (e) {
            if (e.message !== 'cancelled') this._error = `${failed}: ${e.message}`;
            return null;
        } finally {
            await this._load();
        }
    }

    // ---- adding and editing ----

    async _save(e, form, id) {
        e.preventDefault();
        if (!form.what.trim()) return;
        this._busy = id ?? 'add';
        const ok = await this._act('save-todo', { ...(id ? { id } : {}), what: form.what.trim(), who: form.who.trim(),
            description: form.description, due: form.due }, "Couldn't save the todo");
        this._busy = null;
        if (!ok) return;
        if (id) this._editing = null;
        else {
            this._form = { what: '', who: '', description: '', due: '' };
            this._closeAdd();
        }
    }

    _openAdd() {
        // showModal focuses the first field (it has autofocus); what you typed before is kept.
        this.renderRoot.querySelector('dialog.add')?.showModal();
    }

    _closeAdd() {
        this.renderRoot.querySelector('dialog.add')?.close();
    }

    _fields(form, set, id) {
        return html`<form @submit=${e => this._save(e, form, id)}>
            ${id ? '' : html`<h2>Add todo</h2>`}
            <label>What you have to do
                <input required maxlength="300" ?autofocus=${!id} .value=${form.what} @input=${e => set({ ...form, what: e.target.value })}></label>
            <div class="row">
                <label>Who asked (optional)
                    <input maxlength="100" .value=${form.who} @input=${e => set({ ...form, who: e.target.value })}></label>
                <label>Delivery date (optional)
                    <input type="date" .value=${form.due} @input=${e => set({ ...form, due: e.target.value })}></label>
            </div>
            <label>Description (optional, Markdown)
                <textarea maxlength="20000" .value=${form.description} @input=${e => set({ ...form, description: e.target.value })}></textarea></label>
            <div class="buttons">
                <button type="submit" ?disabled=${!form.what.trim() || this._busy === (id ?? 'add')}>${id ? 'Save' : 'Add todo'}</button>
                <button type="button" class="quiet" @click=${() => { if (id) this._editing = null; else this._closeAdd(); }}>Cancel</button>
            </div>
        </form>`;
    }

    // ---- Ask AI ----

    async _openAsk(t) {
        this._issue = null;
        this._link = null;
        this._ask = { id: t.id, mode: 'investigate', repo: '', web: false, suggesting: this._repos.length > 1 };
        if (!this._repos.length) return;
        if (this._repos.length === 1) {
            this._ask = { ...this._ask, repo: this._repos[0] };
            return;
        }
        try {
            const r = await elf.act('suggest-repo', { id: t.id });
            if (this._ask?.id === t.id && this._repos.includes(r?.repo)) this._ask = { ...this._ask, repo: r.repo };
        } catch (e) {
            // Only a suggestion: you pick one yourself.
        }
        if (this._ask?.id === t.id) this._ask = { ...this._ask, suggesting: false };
    }

    async _startAsk() {
        const a = this._ask;
        this._ask = { ...a, starting: true };
        const ok = await this._act('ask-ai', { id: a.id, mode: a.mode, repo: a.repo, web: !!(a.repo && a.web) }, "Couldn't ask the AI");
        this._ask = ok ? null : { ...a, starting: false };
    }

    _askBox(t) {
        const a = this._ask;
        const web = !!(a.repo && a.web);
        return html`<div class="box">
            <div class="modes" role="radiogroup" aria-label="What to ask">
                ${Object.entries({ investigate: 'Investigate', opinion: 'Give an opinion' }).map(([k, v]) => html`<label>
                    <input type="radio" name="mode" .checked=${a.mode === k} @change=${() => { this._ask = { ...a, mode: k }; }}>${v}</label>`)}
            </div>
            <label>Repo for context
                <select ?disabled=${a.suggesting} @change=${e => { this._ask = { ...this._ask, repo: e.target.value }; }}>
                    ${this._repos.map(r => html`<option value=${r} ?selected=${a.repo === r}>${r}</option>`)}
                    <option value="" ?selected=${!a.repo}>No repo: answer from the todo's text</option>
                </select></label>
            <div class="modes"><label>
                <input type="checkbox" .checked=${web} ?disabled=${!a.repo} @change=${e => { this._ask = { ...this._ask, web: e.target.checked }; }}>
                Search the web too</label></div>
            ${a.suggesting ? html`<span class="meta" role="status">${spinner}Picking the likeliest repo...</span>` : ''}
            ${!this._repos.length ? html`<span class="meta">Add your repos in Settings to let the AI read their code.</span>` : ''}
            <div class="buttons">
                <button ?disabled=${a.suggesting || a.starting} @click=${() => this._startAsk()}>${a.repo ? 'Start the agent' : 'Ask Claude'}</button>
                <button class="quiet" @click=${() => { this._ask = null; }}>Cancel</button>
                ${a.starting ? html`<span class="meta" role="status">${spinner}${a.repo ? 'Starting...' : 'Claude is reading it...'}</span>` : ''}
            </div>
            <span class="meta">${!a.repo ? 'Claude reads only the todo. Nothing is sent anywhere.'
                : web ? `An agent reads a fresh clone of ${a.repo} and searches the web. Only for a public repo, and a todo in your own words: what it searches for goes to the web.`
                : `An agent reads a fresh clone of ${a.repo}. It can only read the code, not change it.`}</span>
        </div>`;
    }

    _report(r, t) {
        const live = r.agent ? this._agents?.[r.agent] : null;
        const status = r.status === 'running' && live ? live.status : r.status;
        // The live answer is shown only as text until the elf has checked it; its links only once it has.
        const out = r.output ?? (status === 'done' ? { ...live?.output, sources: [] } : null);
        const head = html`<span class="meta">${MODE[r.mode] ?? 'Report'}${r.repo ? ` in ${r.repo}${r.web ? ' and on the web' : ''}` : ', from the todo\'s text'}, ${ago(r.at)}</span>`;
        if (status === 'queued' || status === 'running') {
            const line = (live?.lines ?? []).at(-1);
            return html`<div class="report">${head}
                <span class="meta" role="status">${spinner}The agent is reading ${r.repo}...${line ? ` ${String(line).slice(0, 160)}` : ''}</span>
                ${live ? html`<div><button class="quiet" @click=${() => elf.cancelAgent(r.agent).then(() => this._load())}>Stop</button></div>` : ''}
            </div>`;
        }
        if (!out) {
            return html`<div class="report">${head}<p class="error" role="alert">The AI didn't finish${r.error || live?.error ? `: ${r.error || live.error}` : ''}. Ask again.</p></div>`;
        }
        return html`<div class="report">${head}
            ${out.opinion ? html`<h3>Opinion</h3><p>${out.opinion}</p>` : ''}
            ${out.involves ? html`<h3>What it involves</h3><p>${out.involves}</p>` : ''}
            ${out.where?.length ? html`<h3>Where it touches</h3><ul>${out.where.map(w => html`<li><code>${w.path}</code>: ${w.why}</li>`)}</ul>` : ''}
            ${out.risks?.length ? html`<h3>Risks</h3><ul>${out.risks.map(x => html`<li>${x}</li>`)}</ul>` : ''}
            ${out.size ? html`<h3>Size</h3><p>${SIZE[out.size] ?? out.size}${out.sizeWhy ? `: ${out.sizeWhy}` : ''}</p>` : ''}
            ${out.sources?.length ? html`<h3>From the web</h3><ul>${out.sources.filter(u => u.startsWith('https://'))
                .map(u => html`<li><a href=${u} target="_blank" rel="noopener">${u}</a></li>`)}</ul>` : ''}
        </div>`;
    }

    // ---- Create issue and Link issue, for a todo or one step of its checklist ----

    async _openIssue(t, item = '') {
        this._ask = null;
        this._link = null;
        this._issue = { id: t.id, item, drafting: true };
        const same = () => this._issue?.id === t.id && this._issue?.item === item;
        try {
            const d = await elf.act('draft-issue', { id: t.id, item });
            if (same()) this._issue = { id: t.id, item, repo: d.repo, title: d.title, body: d.body };
        } catch (e) {
            if (same()) this._issue = { id: t.id, item, error: `Couldn't draft the issue: ${e.message}` };
        }
    }

    async _createIssue() {
        const i = this._issue;
        this._issue = { ...i, creating: true };
        const ok = await this._act('create-issue', { id: i.id, item: i.item, repo: i.repo, title: i.title.trim(), body: i.body },
            "Couldn't create the issue");
        this._issue = ok ? null : { ...i, creating: false };
    }

    _issueBox() {
        const i = this._issue;
        if (i.drafting) return html`<div class="box"><span class="meta" role="status">${spinner}Claude is drafting the issue...</span></div>`;
        if (i.error) {
            return html`<div class="box"><p class="error" role="alert">${i.error}</p>
                <div class="buttons"><button class="quiet" @click=${() => { this._issue = null; }}>Close</button></div></div>`;
        }
        const set = patch => { this._issue = { ...this._issue, ...patch }; };
        return html`<div class="box">
            <label>Repo
                <select @change=${e => set({ repo: e.target.value })}>
                    ${this._repos.map(r => html`<option value=${r} ?selected=${i.repo === r}>${r}</option>`)}
                </select></label>
            <label>Title <input maxlength="256" .value=${i.title} @input=${e => set({ title: e.target.value })}></label>
            <label>Body (Markdown) <textarea class="body" maxlength="60000" .value=${i.body} @input=${e => set({ body: e.target.value })}></textarea></label>
            <div class="buttons">
                <button ?disabled=${!i.title.trim() || !i.repo || i.creating} @click=${() => this._createIssue()}>Create issue</button>
                <button class="quiet" @click=${() => { this._issue = null; }}>Cancel</button>
                ${i.creating ? html`<span class="meta" role="status">${spinner}Creating...</span>` : ''}
            </div>
            <span class="meta">Nothing is posted until you confirm it in the desk.</span>
        </div>`;
    }

    _openLink(t, item = '') {
        this._ask = null;
        this._issue = null;
        this._link = { id: t.id, item, repo: this._repos[0] ?? '', number: '' };
    }

    async _linkIssue() {
        const l = this._link;
        this._link = { ...l, linking: true };
        const ok = await this._act('link-issue', { id: l.id, item: l.item, repo: l.repo, number: Number(l.number) }, "Couldn't link the issue");
        this._link = ok ? null : { ...l, linking: false };
    }

    _linkBox() {
        const l = this._link;
        if (!this._repos.length) {
            return html`<div class="box"><p class="meta">Add your repos in Settings first: it only links issues there.</p>
                <div class="buttons"><button class="quiet" @click=${() => { this._link = null; }}>Close</button></div></div>`;
        }
        const set = patch => { this._link = { ...this._link, ...patch }; };
        const ok = /^[1-9]\d{0,8}$/.test(String(l.number).trim());
        return html`<div class="box">
            <div class="row">
                <label>Repo
                    <select @change=${e => set({ repo: e.target.value })}>
                        ${this._repos.map(r => html`<option value=${r} ?selected=${l.repo === r}>${r}</option>`)}
                    </select></label>
                <label>Issue number <input inputmode="numeric" .value=${l.number} @input=${e => set({ number: e.target.value.replace(/^#/, '') })}></label>
            </div>
            <div class="buttons">
                <button ?disabled=${!ok || l.linking} @click=${() => this._linkIssue()}>Link issue</button>
                <button class="quiet" @click=${() => { this._link = null; }}>Cancel</button>
                ${l.linking ? html`<span class="meta" role="status">${spinner}Looking it up...</span>` : ''}
            </div>
        </div>`;
    }

    /** An issue's link, its title and whether it's closed. Only links the script made (github.com issue URLs). */
    _issueLink(t, i, unlink = true) {
        return html`<span class="issue">
            ${i.url?.startsWith('https://github.com/') ? html`<a href=${i.url} target="_blank" rel="noopener">${i.repo}#${i.number}</a>` : html`${i.repo}#${i.number}`}
            ${i.title ? html`<span class="meta">${i.title}</span>` : ''}
            ${i.state === 'closed' ? html`<span class="flag closed">Closed</span>` : ''}
            ${unlink ? html`<button class="link" title="Unlink issue: it stays on GitHub"
                @click=${() => this._act('unlink-issue', { id: t.id, repo: i.repo, number: i.number }, "Couldn't unlink it")}>Unlink</button>` : ''}
        </span>`;
    }

    // ---- the checklist ----

    async _addStep(e, t) {
        e.preventDefault();
        const text = (this._steps[t.id] ?? '').trim();
        if (!text) return;
        if (await this._act('save-item', { id: t.id, text }, "Couldn't add the step")) this._steps = { ...this._steps, [t.id]: '' };
    }

    async _saveStep(e, t) {
        e.preventDefault();
        const s = this._stepEdit;
        if (!s.text.trim()) return;
        if (await this._act('save-item', { id: t.id, item: s.item, text: s.text.trim() }, "Couldn't save the step")) this._stepEdit = null;
    }

    _checklist(t) {
        const items = t.checklist ?? [];
        const issues = t.issues ?? [];
        const open = !t.done;
        if (!items.length && !open) return '';
        const ticked = items.filter(i => i.done).length;
        return html`<div class="box">
            ${items.length ? html`<span class="meta">Checklist, ${ticked} of ${items.length} done</span>` : ''}
            ${items.length ? html`<ul class="steps">${items.map(i => {
                const issue = issues.find(x => x.item === i.id);
                if (this._stepEdit?.item === i.id) {
                    return html`<li><form class="step-edit" @submit=${e => this._saveStep(e, t)}>
                        <input maxlength="300" .value=${this._stepEdit.text} @input=${e => { this._stepEdit = { ...this._stepEdit, text: e.target.value }; }}>
                        <button type="submit">Save</button>
                        <button type="button" class="quiet" @click=${() => { this._stepEdit = null; }}>Cancel</button></form></li>`;
                }
                return html`<li>
                    <label class="step ${i.done ? 'ticked' : ''}"><input type="checkbox" .checked=${!!i.done}
                        @change=${e => this._act('check-item', { id: t.id, item: i.id, done: e.target.checked }, "Couldn't tick it")}>${i.text}</label>
                    <span class="buttons">
                        ${issue ? this._issueLink(t, issue) : open ? html`
                            <button class="link" @click=${() => this._openIssue(t, i.id)}>Create issue</button>
                            <button class="link" @click=${() => this._openLink(t, i.id)}>Link issue</button>` : ''}
                        ${open ? html`<button class="link" @click=${() => { this._stepEdit = { item: i.id, text: i.text }; }}>Edit</button>` : ''}
                        <button class="link" @click=${() => this._act('delete-item', { id: t.id, item: i.id }, "Couldn't delete the step")}>Delete</button>
                    </span>
                    ${this._issue?.id === t.id && this._issue.item === i.id ? this._issueBox() : ''}
                    ${this._link?.id === t.id && this._link.item === i.id ? this._linkBox() : ''}
                </li>`;
            })}</ul>` : ''}
            ${open ? html`<form class="step-edit" @submit=${e => this._addStep(e, t)}>
                <input maxlength="300" placeholder="Add a step" aria-label="Add a step to the checklist" .value=${this._steps[t.id] ?? ''}
                    @input=${e => { this._steps = { ...this._steps, [t.id]: e.target.value }; }}>
                <button type="submit" class="quiet" ?disabled=${!(this._steps[t.id] ?? '').trim()}>Add step</button>
            </form>` : ''}
        </div>`;
    }

    // ---- the list ----

    _item(t) {
        if (this._editing?.id === t.id) {
            return html`<li class="panel">${this._fields(this._editing.form, form => { this._editing = { id: t.id, form }; }, t.id)}</li>`;
        }
        const due = dueState(t, this._soon);
        const reports = t.reports ?? [];
        const issues = (t.issues ?? []).filter(i => !i.item || !(t.checklist ?? []).some(c => c.id === i.item));
        const all = t.issues ?? [];
        const allClosed = all.length && all.every(i => i.state === 'closed');
        return html`<li class="panel ${t.done ? 'done' : due}">
            <div class="buttons">
                <span class="what">${t.what}</span>
                ${due === 'overdue' ? html`<span class="flag overdue">Overdue</span>` : due === 'today' ? html`<span class="flag today">Due today</span>`
                    : due === 'soon' ? html`<span class="flag soon">Due soon</span>` : ''}
                ${allClosed && !t.done ? html`<span class="flag closed">${all.length === 1 ? 'Issue closed' : 'All issues closed'}</span>` : ''}
            </div>
            <div class="meta">
                ${t.who ? html`<span>Asked by ${t.who}</span>` : ''}
                <span>Added ${ago(t.created)}</span>
                ${t.due ? html`<span>Due ${dayText(t.due)}</span>` : ''}
                ${t.done ? html`<span>Done ${ago(t.done)}</span>` : ''}
            </div>
            ${issues.length ? html`<div class="issues">${issues.map(i => this._issueLink(t, i, !t.done))}</div>` : ''}
            ${t.description ? html`<div class="desc md">${markdown(t.description)}</div>` : ''}
            ${this._checklist(t)}
            <div class="buttons">
                ${t.done ? html`<button class="quiet" @click=${() => this._act('set-done', { id: t.id, done: false }, "Couldn't change it")}>Not done</button>`
                    : html`<button @click=${() => this._act('set-done', { id: t.id, done: true }, "Couldn't mark it done")}>Mark done</button>
                        <button class="quiet" @click=${() => this._openAsk(t)}>Ask AI</button>
                        <button class="quiet" @click=${() => this._openIssue(t)}>Create issue</button>
                        <button class="quiet" @click=${() => this._openLink(t)}>Link issue</button>
                        <button class="quiet" @click=${() => { this._editing = { id: t.id, form: { what: t.what ?? '', who: t.who ?? '', description: t.description ?? '', due: t.due ?? '' } }; }}>Edit</button>`}
                <button class="quiet" @click=${() => this._act('delete-todo', { id: t.id }, "Couldn't delete it")}>Delete</button>
            </div>
            ${this._ask?.id === t.id ? this._askBox(t) : ''}
            ${this._issue?.id === t.id && !this._issue.item ? this._issueBox() : ''}
            ${this._link?.id === t.id && !this._link.item ? this._linkBox() : ''}
            ${reports.length ? html`<div class="box">
                ${this._report(reports[0], t)}
                ${reports.length > 1 ? html`<details><summary class="meta">${count(reports.length - 1, 'earlier report')}</summary>
                    ${reports.slice(1).map(r => this._report(r, t))}</details>` : ''}
            </div>` : ''}
        </li>`;
    }

    render() {
        const todos = this._list?.todos ?? [];
        const open = sortOpen(todos);
        const done = todos.filter(t => t.done).sort((a, b) => b.done.localeCompare(a.done));
        const overdue = open.filter(t => dueState(t, this._soon) === 'overdue').length;
        return html`
            <div class="page">
                <div class="page-top"><div>
                    <h1>Todo list</h1>
                    <p class="sub">${this._loading && !this._list ? '' : todos.length
                        ? `${open.length} open${overdue ? `, ${overdue} overdue` : ''}.${this._list.checkedAt ? ` Issues checked ${runTime(this._list.checkedAt).toLowerCase()}.` : ''}`
                        : 'Nothing on your list yet.'}</p>
                </div><div class="top-buttons">
                    <button @click=${() => this._openAdd()}>Add todo</button>
                    ${settingsButton(null, 'Todo list settings')}
                </div></div>
                <elf-run-bar command="check" label="Check issues"
                    note="Checks whether the issues linked to your todos are still open, and updates the overdue flags. Changes nothing on GitHub."
                    @run-finished=${() => this._load()}></elf-run-bar>
                ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : ''}
                <dialog class="add" aria-label="Add todo">${this._fields(this._form, form => { this._form = form; })}</dialog>
                ${this._loading && !this._list ? html`<div class="skeleton big"></div>`
                    : open.length ? html`<ul>${open.map(t => this._item(t))}</ul>`
                    : html`<p class="panel empty">${done.length ? 'Nothing open: everything on your list is done.'
                        : 'Click Add todo to add your first one. Add your repos in Settings to create issues from todos and let the AI read their code.'}</p>`}
                ${done.length ? html`<details class="done-list"><summary>Done (${done.length})</summary>
                    <ul>${done.map(t => this._item(t))}</ul></details>` : ''}
            </div>
        `;
    }
}

/** The dashboard card: "7 open, 2 overdue", and it asks for your attention when something is overdue or due today. */
class TodoListCard extends LitElement {

    static properties = { _open: { state: true }, _overdue: { state: true }, _today: { state: true }, _soon: { state: true },
        _loaded: { state: true }, _state: { state: true } };
    static styles = [shared, cardStyles];

    constructor() {
        super();
        new Ticking(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
        this._off = elf.onChange(() => this._load());
    }

    disconnectedCallback() {
        this._off?.();
        super.disconnectedCallback();
    }

    async _load() {
        try {
            const list = await loadTodos();
            const days = await soonDays();
            const open = (list.todos ?? []).filter(t => !t.done);
            const states = open.map(t => dueState(t, days));
            this._open = open.length;
            this._overdue = states.filter(s => s === 'overdue').length;
            this._today = states.filter(s => s === 'today').length;
            this._soon = states.filter(s => s === 'soon').length;
            this._state = await elf.state();
        } catch (e) {
            this._open = null;
        }
        this._loaded = true;
        elf.card({ attention: this._overdue > 0 || this._today > 0 });
    }

    render() {
        if (!this._loaded) return html`<div class="skeleton say-sk"></div>`;
        const parts = [
            this._overdue ? `${this._overdue} overdue` : '',
            this._today ? `${this._today} due today` : '',
            this._soon ? `${this._soon} due soon` : '',
        ].filter(Boolean);
        const say = !this._open ? html`Nothing to do. <a href="#">Add a todo</a>.`
            : html`<a href="#">${this._open} open</a>${parts.length ? `, ${parts.join(', ')}` : ''}.`;
        const running = this._state?.running?.check;
        return html`<p class="say">${say}</p>
            <div class="meta">${running ? html`<span class="running" role="status">${spinner}Checking issues, started ${ago(running)}</span>` : ''}</div>`;
    }
}

customElements.define('todo-list-tab', TodoListTab);
customElements.define('todo-list-card', TodoListCard);
document.body.append(document.createElement(elf.view === 'card' ? 'todo-list-card' : 'todo-list-tab'));
