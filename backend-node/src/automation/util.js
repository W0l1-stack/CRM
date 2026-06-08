// Shared automation helpers used by the trigger engine, the journey engine and
// the step worker.

// Convert a wait config to milliseconds.
function waitMs(config = {}) {
  const days = Number(config.days || 0);
  const hours = Number(config.hours || 0);
  const minutes = Number(config.minutes || 0);
  return (((days * 24 + hours) * 60 + minutes) * 60) * 1000;
}

// {{contact.field}} / {{field}} substitution (accepts {{name}}, {{company_name}}).
function render(template, contact) {
  return String(template || '').replace(/\{\{\s*(?:contact\.)?(\w+)\s*\}\}/g, (_m, key) => {
    const k = key === 'company_name' ? 'company' : key === 'full_name' ? 'name' : key;
    return contact && contact[k] != null ? String(contact[k]) : '';
  });
}

function fieldValue(contact, field) {
  if (!contact || !field) return undefined;
  if (field === 'tags') return Array.isArray(contact.tags) ? contact.tags : [];
  if (contact[field] != null) return contact[field];
  if (contact.custom_fields && contact.custom_fields[field] != null) return contact.custom_fields[field];
  return undefined;
}

// Evaluate one data-branch case condition against a contact.
function matchesCondition(contact, cond = {}) {
  const op = cond.op || 'has_tag';
  const target = String(cond.value == null ? '' : cond.value).trim().toLowerCase();
  if (op === 'has_tag') {
    const tags = (fieldValue(contact, 'tags') || []).map((t) => String(t).toLowerCase());
    return tags.includes(target);
  }
  const raw = fieldValue(contact, cond.field);
  const v = raw == null ? '' : String(raw).toLowerCase();
  switch (op) {
    case 'equals': return v === target;
    case 'not_equals': return v !== target;
    case 'contains': return target !== '' && v.includes(target);
    case 'not_empty': return Array.isArray(raw) ? raw.length > 0 : v.trim() !== '';
    case 'empty': return Array.isArray(raw) ? raw.length === 0 : v.trim() === '';
    default: return false;
  }
}

module.exports = { waitMs, render, fieldValue, matchesCondition };
