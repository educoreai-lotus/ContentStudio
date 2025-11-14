# Content Studio Background System - Tailwind Mapping

This document provides the complete Tailwind CSS class mappings for the Content Studio background system.

## 🎨 DAY MODE Background Variables

| CSS Variable | Hex Value | Tailwind Class |
|-------------|-----------|----------------|
| `--bg-primary` | `#f8fafc` | `bg-[#f8fafc]` |
| `--bg-secondary` | `#e2e8f0` | `bg-[#e2e8f0]` |
| `--bg-tertiary` | `#cbd5e1` | `bg-[#cbd5e1]` |
| `--bg-card` | `#ffffff` | `bg-white` or `bg-[#ffffff]` |

## 🌙 NIGHT MODE Background Variables

| CSS Variable | Hex Value | Tailwind Class |
|-------------|-----------|----------------|
| `--bg-primary` | `#0f172a` | `dark:bg-[#0f172a]` |
| `--bg-secondary` | `#1e293b` | `dark:bg-[#1e293b]` |
| `--bg-tertiary` | `#334155` | `dark:bg-[#334155]` |
| `--bg-card` | `#1e293b` | `dark:bg-[#1e293b]` |

## 📋 Component Background Mappings

### 1. Body / Page Background
**Day Mode:** `bg-[#f8fafc]`  
**Night Mode:** `dark:bg-[#0f172a]`  
**Combined:** `bg-[#f8fafc] dark:bg-[#0f172a]`

### 2. Section Wrappers (Hero, Dashboard, Microservices)
**Day Mode:** `bg-[#e2e8f0]`  
**Night Mode:** `dark:bg-[#1e293b]`  
**Combined:** `bg-[#e2e8f0] dark:bg-[#1e293b]`

### 3. Card Backgrounds
**Day Mode:** `bg-white` or `bg-gradient-to-br from-white to-[#f0fdfa]`  
**Night Mode:** `dark:bg-[#1e293b]` or `dark:bg-gradient-to-br dark:from-[#1e293b] dark:to-[#334155]`  
**Combined:** `bg-white dark:bg-[#1e293b]` or `bg-gradient-to-br from-white to-[#f0fdfa] dark:from-[#1e293b] dark:to-[#334155]`

### 4. Header / Navbar
**Day Mode:** `bg-white/95` (with backdrop-blur)  
**Night Mode:** `dark:bg-[#0f172a]/95` (with backdrop-blur)  
**Combined:** `bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md`

### 5. Buttons - Primary (Gradient)
**Day Mode:** `bg-gradient-to-r from-[#065f46] to-[#047857]`  
**Night Mode:** `dark:from-[#0d9488] dark:to-[#059669]`  
**Combined:** `bg-gradient-to-r from-[#065f46] to-[#047857] dark:from-[#0d9488] dark:to-[#059669]`

### 6. Buttons - Secondary
**Day Mode:** `bg-transparent` with border  
**Night Mode:** `dark:bg-transparent dark:border-white/20`  
**Combined:** `bg-transparent dark:bg-transparent border-2 border-gray-300 dark:border-white/20`

### 7. Input Backgrounds
**Day Mode:** `bg-white`  
**Night Mode:** `dark:bg-[#1e293b]`  
**Combined:** `bg-white dark:bg-[#1e293b]`

### 8. Modal Backgrounds
**Day Mode:** `bg-white`  
**Night Mode:** `dark:bg-[#1e293b]`  
**Combined:** `bg-white dark:bg-[#1e293b]`

### 9. Sidebar Backgrounds
**Day Mode:** `bg-white`  
**Night Mode:** `dark:bg-[#1e293b]`  
**Combined:** `bg-white dark:bg-[#1e293b]`

### 10. Subtle Panels / Nested Elements
**Day Mode:** `bg-[#cbd5e1]`  
**Night Mode:** `dark:bg-[#334155]`  
**Combined:** `bg-[#cbd5e1] dark:bg-[#334155]`

## 🎨 Gradient Mappings

### Day Mode Gradients
- **Primary:** `bg-gradient-to-r from-[#065f46] to-[#047857]`
- **Secondary:** `bg-gradient-to-r from-[#0f766e] to-[#047857]`
- **Accent:** `bg-gradient-to-r from-[#d97706] to-[#f59e0b]`
- **Card:** `bg-gradient-to-br from-white to-[#f0fdfa]`

### Night Mode Gradients
- **Primary:** `dark:bg-gradient-to-r dark:from-[#0d9488] dark:to-[#059669]`
- **Secondary:** `dark:bg-gradient-to-r dark:from-[#14b8a6] dark:to-[#10b981]`
- **Accent:** `dark:bg-gradient-to-r dark:from-[#d97706] dark:to-[#f59e0b]`
- **Card:** `dark:bg-gradient-to-br dark:from-[#1e293b] dark:to-[#334155]`

## 📝 Usage Rules

1. **Body/Page:** ALWAYS use `--bg-primary`
2. **Sections:** Use `--bg-secondary` for major sections
3. **Cards:** Use `--bg-card` or card gradient
4. **Subtle Elements:** Use `--bg-tertiary` for nested/panel elements
5. **Never invent new colors** - use ONLY the defined variables
6. **Always provide both Day and Night mode classes**

## ✅ Examples

### Correct Usage:
```jsx
// Body
<div className="bg-[#f8fafc] dark:bg-[#0f172a]">

// Section
<section className="bg-[#e2e8f0] dark:bg-[#1e293b]">

// Card
<div className="bg-white dark:bg-[#1e293b]">
// OR with gradient
<div className="bg-gradient-to-br from-white to-[#f0fdfa] dark:from-[#1e293b] dark:to-[#334155]">
```

### Incorrect Usage:
```jsx
// ❌ DON'T use arbitrary colors
<div className="bg-gray-100 dark:bg-slate-900">

// ❌ DON'T use colors not in the system
<div className="bg-blue-50 dark:bg-indigo-900">
```

