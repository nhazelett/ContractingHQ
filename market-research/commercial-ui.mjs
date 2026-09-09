import {
  packageUnitPrice,
  formatPrice,
  productValues,
  productEvidence,
  worksheetProducts,
  comparisonCSV,
} from "./commercial.mjs?v=20260909-5";
import { escapeHTML as esc, safeURL, today } from "./core.mjs?v=20260909-5";
export function initCommercial({
  getProject,
  persist,
  notice,
  setView,
  nextCitation,
}) {
  const $ = (selector) => document.querySelector(selector),
    form = $("#product-form");
  let editing = null;
  function render() {
    renderTable();
  }
  function renderTable() {
    const rows = worksheetProducts(getProject().evidence);
    $("#export-products").disabled = !rows.length;
    $("#product-comparison").innerHTML = rows.length
      ? `<div class="comparison-scroll" tabindex="0" role="region" aria-label="Product comparison table"><table class="product-table"><caption>${rows.length} recorded products · prices require source review</caption><thead><tr><th scope="col">Product / seller</th><th scope="col">Price basis & package</th><th scope="col">Per-unit price</th><th scope="col">Specifications & terms</th><th scope="col">Requirement fit</th><th scope="col">Actions</th></tr></thead><tbody>${rows
          .map((e) => {
            const p = productValues(e),
              u = packageUnitPrice(p.price, p.units),
              quote = p.basis === "Quote required";
            return `<tr><th scope="row"><span class="badge">${esc(e.citation)}</span><a href="${esc(safeURL(e.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)} ↗</a><p>${esc(p.company)}<br>${esc(p.model || "Model not recorded")}<br>${esc(p.condition)}</p><small>Checked ${esc(p.date)}<br>${esc(e.verification)}</small></th><td><strong>${quote ? "Quote required" : p.price === "" ? "Not recorded" : esc(formatPrice(Number(p.price), p.currency))}</strong><p>${esc(p.basis)}<br>${esc(p.units || "Unknown")} ${esc(p.unit || "units")} per package</p></td><td><strong>${quote ? "Quote required" : u === null ? "Not recorded" : esc(formatPrice(u, p.currency))}</strong>${u !== null && !quote ? `<p>per ${esc(p.unit || "unit")}</p>` : ""}<small>Review shipping, taxes, installation, and terms separately.</small></td><td><details><summary>View details</summary><p>${esc(p.specs || "Specifications not recorded")}</p><p><strong>Shipping / delivery:</strong> ${esc(p.shipping || "Not recorded")}</p><p><strong>Installation / other:</strong> ${esc(p.installation || "Not recorded")}</p><p><strong>Terms:</strong> ${esc(p.terms || "Not recorded")}</p></details></td><td><p>${esc(p.note || "Not assessed")}</p></td><td><button type="button" data-edit-product="${esc(e.id)}">Edit</button><button type="button" class="danger-link" data-delete-product="${esc(e.id)}">Remove</button></td></tr>`;
          })
          .join("")}</tbody></table></div>`
      : '<div class="empty-state"><h3>No products recorded yet</h3><p>Add a product link, seller, specifications, and price from your research. Each entry is also saved in your evidence file.</p></div>';
  }
  function pricePreview() {
    const quote = form.elements.basis.value === "Quote required";
    form.elements.price.disabled = quote;
    $("#product-unit-price").textContent = quote
      ? "Quote required"
      : formatPrice(
          packageUnitPrice(
            form.elements.price.value,
            form.elements.units.value,
          ),
          form.elements.currency.value,
        ) +
        (packageUnitPrice(
          form.elements.price.value,
          form.elements.units.value,
        ) === null
          ? ""
          : " per " + (form.elements.unit.value || "unit"));
  }
  function reset() {
    editing = null;
    form.reset();
    form.elements.date.value = today();
    form.elements.date.max = today();
    form.elements.price.disabled = false;
    $("#product-editor").open = false;
    $("#product-editor-title").textContent = "Record a product";
    $("#save-product").textContent = "Save product to evidence";
    $("#product-form-error").hidden = true;
    pricePreview();
  }
  function open(id = null) {
    reset();
    const existing = getProject().evidence.find((e) => e.id === id);
    if (existing) {
      editing = id;
      for (const [key, value] of Object.entries(productValues(existing)))
        if (form.elements[key]) form.elements[key].value = value;
      $("#product-editor-title").textContent = "Edit " + existing.citation;
      $("#save-product").textContent = "Save changes";
      pricePreview();
    }
    $("#product-editor").open = true;
    form.elements.title.focus();
  }
  form.oninput = pricePreview;
  form.onchange = pricePreview;
  form.onsubmit = (e) => {
    e.preventDefault();
    const p = getProject(),
      existing = editing ? p.evidence.find((e) => e.id === editing) : null;
    try {
      if (editing && !existing)
        throw new Error(
          "This evidence entry no longer exists. Add a new product.",
        );
      if (!existing && p.evidence.length >= 300)
        throw new Error(
          "This file has 300 evidence records. Export it and start another file.",
        );
      const entry = productEvidence(
        Object.fromEntries(new FormData(form)),
        existing,
      );
      if (existing) p.evidence[p.evidence.indexOf(existing)] = entry;
      else {
        entry.citation = nextCitation();
        p.evidence.push(entry);
      }
      persist();
      reset();
      renderTable();
      notice(
        `${entry.citation} saved to the comparison and evidence file. Verify the source before relying on it.`,
      );
      $("#product-comparison").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      $("#product-form-error").textContent = error.message;
      $("#product-form-error").hidden = false;
    }
  };
  $("#new-product").onclick = () => open();
  $("#cancel-product").onclick = reset;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.editProduct) {
      setView("commercial");
      open(b.dataset.editProduct);
    }
    if (b.dataset.deleteProduct) {
      const p = getProject(),
        i = p.evidence.findIndex((e) => e.id === b.dataset.deleteProduct);
      if (i < 0) return;
      const [removed] = p.evidence.splice(i, 1);
      if (editing === removed.id) reset();
      persist();
      renderTable();
      notice(
        `${removed.citation} removed from the worksheet and evidence file.`,
      );
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Undo";
      undo.onclick = () => {
        if (!p.evidence.some((e) => e.id === removed.id)) {
          p.evidence.splice(i, 0, removed);
          persist();
          renderTable();
        }
        $("#notice").hidden = true;
      };
      $("#notice").append(undo);
    }
  });
  $("#export-products").onclick = () => {
    const rows = worksheetProducts(getProject().evidence);
    if (!rows.length) return;
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + comparisonCSV(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "commercial-product-comparison-" + today() + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  reset();
  return { render, reset };
}
