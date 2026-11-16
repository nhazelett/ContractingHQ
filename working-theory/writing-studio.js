(function () {
  'use strict';
  function el(tag, text, cls) { var n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function field(parent, label, tag, name, required) {
    var id = 'write-' + name;
    var l = el('label', label); l.htmlFor = id;
    var input = el(tag); input.id = id; input.name = name; input.required = !!required;
    parent.append(l, input); return input;
  }
  function paragraphs(parent, text) { text.split(/\n\s*\n/).filter(Boolean).forEach(function (p) { parent.append(el('p', p)); }); }
  window.KTHQWritingStudio = function (options) {
    var container = options.container, mentor = options.mentor, api = options.api;
    var key = 'kthq-writing-draft:' + mentor.id;
    var draftId = crypto.randomUUID();
    var mode = 'take', widget = null, busy = false;
    var studio = el('section', undefined, 'wt-writing-studio');
    studio.append(el('h3', 'What would you like to write?'), el('p', 'Your writing publishes immediately under your approved mentor profile.', 'wt-note'));
    var choices = el('div', undefined, 'wt-write-choices');
    var takeChoice = el('button', 'Write a take', 'wt-write-choice'); takeChoice.type = 'button';
    var essayChoice = el('button', 'Write an original essay', 'wt-write-choice'); essayChoice.type = 'button';
    choices.append(takeChoice, essayChoice); studio.append(choices);
    var form = el('form', undefined, 'wt-form wt-writing-form');
    var topicFields = el('fieldset');
    var select = field(topicFields, 'Which essay are you responding to?', 'select', 'topicSlug', true);
    var placeholder = el('option', 'Choose an essay'); placeholder.value = ''; select.append(placeholder);
    var readLink = el('a', 'Read the selected essay'); readLink.hidden = true; topicFields.append(readLink);
    var essayFields = el('fieldset');
    var title = field(essayFields, 'Essay title', 'input', 'title', true); title.maxLength = 160;
    var summary = field(essayFields, 'A short introduction for the essay card', 'textarea', 'summary', true); summary.maxLength = 500; summary.rows = 2;
    var category = field(essayFields, 'Type', 'select', 'category', true);
    ['Concept','Moment'].forEach(function (value) { var option = el('option', value); option.value = value; category.append(option); });
    form.append(topicFields, essayFields);
    var body = field(form, 'Your take', 'textarea', 'body', true); body.rows = 16;
    var bodyLabel = form.querySelector('label[for="write-body"]');
    var count = el('p', '', 'wt-note'); form.append(count);
    var sourceFields = el('fieldset');
    var sources = field(sourceFields, 'Sources or further reading (optional)', 'textarea', 'sources', false); sources.rows = 3; sources.maxLength = 20000;
    form.append(sourceFields);
    var agreement = el('label', undefined, 'wt-check'), terms = el('input'); terms.type = 'checkbox'; terms.required = true;
    agreement.append(terms, el('span', 'I am writing in a personal capacity, own this writing, and give KTHQ permission to publish it. It contains no CUI or private information about other people.'));
    var bot = el('div'); var message = el('div', '', 'wt-message'); message.setAttribute('role','status');
    var draftNote = el('p', 'Drafts save on this device. Writing is published as plain text; separate paragraphs with a blank line.', 'wt-note');
    var previewButton = el('button','Preview','wt-button'); previewButton.type = 'button';
    var publish = el('button','Publish take','wt-button'); publish.type = 'submit';
    var discard = el('button','Discard draft','wt-button wt-secondary'); discard.type = 'button';
    var preview = el('article',undefined,'wt-writing-preview wt-prose'); preview.hidden = true;
    form.append(agreement, bot, previewButton, publish, discard, message, draftNote, preview); studio.append(form); container.append(studio);
    var allTopics = (options.topics || []).map(function (slug) { return {slug:slug,title:options.titles[slug] || slug.replace(/-/g,' '),url:'/working-theory/' + encodeURIComponent(slug) + '.html'}; });
    function addTopic(item) { var option = el('option',item.title); option.value = item.slug; select.append(option); }
    allTopics.forEach(addTopic);
    function update() {
      takeChoice.setAttribute('aria-pressed',String(mode === 'take')); essayChoice.setAttribute('aria-pressed',String(mode === 'essay'));
      topicFields.hidden = topicFields.disabled = mode !== 'take';
      essayFields.hidden = essayFields.disabled = mode !== 'essay'; sourceFields.hidden = sourceFields.disabled = mode !== 'essay';
      bodyLabel.textContent = mode === 'essay' ? 'Your essay' : 'Your take';
      publish.textContent = busy ? 'Publishing…' : mode === 'essay' ? 'Publish essay' : 'Publish take'; publish.disabled = busy;
      var words = body.value.trim() ? body.value.trim().split(/\s+/).length : 0;
      count.textContent = words + ' words · ' + Math.max(1,Math.ceil(words / 220)) + ' min read';
      var selected = allTopics.find(function (item) { return item.slug === select.value; });
      readLink.hidden = !selected; if (selected) readLink.href = selected.url;
    }
    function save() {
      try { localStorage.setItem(key, JSON.stringify({mode:mode,topicSlug:select.value,title:title.value,summary:summary.value,category:category.value,body:body.value,sources:sources.value,submissionId:draftId,savedAt:Date.now()})); }
      catch (_) { draftNote.textContent = 'This browser could not save your draft. Copy your writing before leaving this page.'; }
    }
    var restoredTopic = '';
    try {
      var draft = JSON.parse(localStorage.getItem(key) || 'null');
      if (draft && Date.now() - draft.savedAt < 604800000 && draft.savedAt <= Date.now()) {
        mode = draft.mode === 'essay' ? 'essay' : 'take';
        [[title,'title'],[summary,'summary'],[category,'category'],[body,'body'],[sources,'sources']].forEach(function (pair) { if (typeof draft[pair[1]] === 'string') pair[0].value = draft[pair[1]]; });
        restoredTopic = draft.topicSlug || ''; select.value = restoredTopic;
        if (/^[a-f0-9-]{36}$/.test(draft.submissionId || '')) draftId = draft.submissionId;
        draftNote.textContent = 'Your saved draft has been restored. Review it before publishing.';
      } else if (draft) localStorage.removeItem(key);
    } catch (_) {}
    takeChoice.addEventListener('click',function () { mode = 'take'; preview.hidden = true; update(); save(); });
    essayChoice.addEventListener('click',function () { mode = 'essay'; preview.hidden = true; update(); save(); });
    form.addEventListener('input',function () { update(); save(); });
    select.addEventListener('change',function () { restoredTopic = ''; update(); save(); });
    discard.addEventListener('click',function () { if (!window.confirm('Discard this saved draft?')) return; form.reset(); draftId = crypto.randomUUID(); try { localStorage.removeItem(key); } catch (_) {} preview.hidden = true; message.replaceChildren(); update(); });
    previewButton.addEventListener('click',function () {
      preview.replaceChildren(el('h2',mode === 'essay' ? title.value || 'Untitled essay' : 'Your take'), el('p',mentor.name,'wt-note'));
      if (mode === 'essay' && summary.value) preview.append(el('p',summary.value,'wt-lede'));
      paragraphs(preview,body.value); if (mode === 'essay' && sources.value) { preview.append(el('h3','Sources')); paragraphs(preview,sources.value); }
      preview.hidden = !preview.hidden;
    });
    function renderBot() {
      if (!studio.isConnected || widget !== null || !window.turnstile) return;
      try { widget = window.turnstile.render(bot,{sitekey:window.KTHQ_WORKING_THEORY.turnstileSiteKey,action:'turnstile-spin-v1','error-callback':function () { message.textContent = 'The bot check could not complete. Your draft is saved; retry the check before publishing.'; }}); }
      catch (_) { message.textContent = 'The bot check could not load. Your draft is still here.'; }
    }
    document.addEventListener('kthq-turnstile-ready',renderBot); renderBot();
    form.addEventListener('submit',async function (event) {
      event.preventDefault(); if (busy) return; save();
      if (widget === null || !window.turnstile.getResponse(widget)) { message.textContent = 'Please complete the bot check before publishing. Your draft is saved.'; return; }
      busy = true; update(); message.textContent = 'Publishing…';
      var payload = {body:body.value,terms:terms.checked,turnstileToken:window.turnstile.getResponse(widget)};
      if (mode === 'essay') Object.assign(payload,{title:title.value,summary:summary.value,category:category.value,sources:sources.value,submissionId:draftId});
      else payload.topicSlug = select.value;
      try {
        var data = await api(mode === 'essay' ? '/essays/submit' : '/takes/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        message.replaceChildren(el('p',data.message));
        if (data.url && data.url.startsWith('/working-theory/')) { var link = el('a','View your published ' + (mode === 'essay' ? 'essay' : 'take')); link.href = data.url; message.append(link); }
        try { localStorage.removeItem(key); } catch (_) {}
        form.reset(); draftId = crypto.randomUUID(); preview.hidden = true;
      } catch (error) { message.textContent = error.message || 'Publishing failed. Your draft is saved.'; }
      finally { busy = false; update(); window.turnstile.reset(widget); }
    });
    (async function () {
      try {
        var cursor = '';
        do {
          var data = await api('/essays' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
          if (!studio.isConnected) return;
          data.essays.forEach(function (essay) { var item = {slug:essay.topicSlug,title:essay.title + ' · ' + essay.mentor.name,url:'/working-theory/essay.html?id=' + encodeURIComponent(essay.id)}; allTopics.push(item); addTopic(item); });
          cursor = data.cursor || '';
        } while (cursor);
        if (restoredTopic) select.value = restoredTopic; update();
      } catch (_) { /* Static essays remain available. */ }
    })();
    update();
  };
})();
