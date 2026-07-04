export function setVMString(vm, name, value) {
  if (!vm) return;

  try {
    const prop = vm.string(name);
    if (!prop) return;

    prop.value = String(value ?? "");
  } catch (error) {
    console.warn(`[VM] erro String ${name}:`, error);
  }
}

export function setVMNumber(vm, name, value) {
  if (!vm) return;

  try {
    const prop = vm.number(name);
    if (!prop) return;

    const numericValue = Number(value);
    prop.value = Number.isFinite(numericValue) ? numericValue : 0;
  } catch (error) {
    console.warn(`[VM] erro Number ${name}:`, error);
  }
}

export function setVMBoolean(vm, name, value) {
  if (!vm) return;

  try {
    const prop = vm.boolean(name);
    if (!prop) return;

    prop.value = Boolean(value);
  } catch (error) {
    console.warn(`[VM] erro Boolean ${name}:`, error);
  }
}

export function setVMEnum(vm, name, value) {
  if (!vm) return;

  try {
    const prop = vm.enum(name);
    if (!prop) return;

    prop.value = String(value ?? "none");
  } catch (error) {
    console.warn(`[VM] erro Enum ${name}:`, error);
  }
}

export function getVMNumber(vm, name, fallback = 0) {
  if (!vm) return fallback;

  try {
    const prop = vm.number(name);
    if (!prop) return fallback;

    const value = Number(prop.value);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getVMEnum(vm, name, fallback = "none") {
  if (!vm) return fallback;

  try {
    const prop = vm.enum(name);
    if (!prop) return fallback;

    return String(prop.value || fallback);
  } catch {
    return fallback;
  }
}

export function applyBindings(vm, bindings, state) {
  if (!vm) return;

  for (const binding of bindings) {
    const value = state[binding.state];

    if (binding.type === "string") {
      setVMString(vm, binding.name, value);
    }

    if (binding.type === "number") {
      setVMNumber(vm, binding.name, value);
    }

    if (binding.type === "boolean") {
      setVMBoolean(vm, binding.name, value);
    }

    if (binding.type === "enum") {
      setVMEnum(vm, binding.name, value);
    }
  }
}