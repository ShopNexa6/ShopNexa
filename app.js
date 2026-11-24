// =====================================
// SHOPNEXA JAVASCRIPT
// =====================================

// Supabase configuration
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const DELIVERY_CHARGE = 100;

const isConfigured =
SUPABASE_URL.startsWith("https://") &&
!SUPABASE_URL.includes("YOUR_") &&
!SUPABASE_ANON_KEY.includes("YOUR_");

const db = isConfigured
? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
: null;

// Variables
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem("shopnexa_cart") || "[]");
let currentUser = null;
let authMode = "login";

// Short selector
const $ = id => document.getElementById(id);

// Currency
function money(amount) {
return "৳" + Number(amount || 0).toLocaleString("en-BD");
}

// HTML safety
function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, char => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
}[char]));
}

// Notification
function notify(message) {
alert(message);
}

// =====================================
// INITIALIZATION
// =====================================

async function initializeShop() {

renderCart();

if (!db) {
    $("productGrid").innerHTML =
        "<p>Supabase সেটআপ করা হয়নি। আগে Supabase URL ও Anon Key বসান।</p>";
    return;
}

const { data: { session } } = await db.auth.getSession();

currentUser = session?.user || null;

updateLoginButton();

db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateLoginButton();
});

await loadStore();

}

// =====================================
// LOAD DATABASE
// =====================================

async function loadStore() {

const categoryResult = await db
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

const productResult = await db
    .from("products")
    .select("*, categories(name)")
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });

if (categoryResult.error || productResult.error) {
    $("productGrid").innerHTML =
        "<p>Database error. SQL setup পরীক্ষা করুন।</p>";
    return;
}

categories = categoryResult.data || [];
products = productResult.data || [];

renderCategories();
renderCategoryFilter();
renderProducts();

}

// =====================================
// CATEGORY
// =====================================

function renderCategories() {

const categoryBox = $("categories");

categoryBox.innerHTML = categories.map(category => `
    <button class="category"
        data-category="${escapeHTML(category.id)}">
        ${escapeHTML(category.name)}
    </button>
`).join("");

document.querySelectorAll("[data-category]").forEach(button => {

    button.addEventListener("click", () => {

        $("categoryFilter").value = button.dataset.category;

        renderProducts();

        $("products").scrollIntoView({
            behavior: "smooth"
        });

    });

});

}

function renderCategoryFilter() {

$("categoryFilter").innerHTML =
    '<option value="">সব ক্যাটাগরি</option>' +
    categories.map(category => `
        <option value="${escapeHTML(category.id)}">
            ${escapeHTML(category.name)}
        </option>
    `).join("");

}

// =====================================
// PRODUCT DISPLAY
// =====================================

function renderProducts() {

let list = [...products];

const search = $("searchInput").value.toLowerCase();

const category = $("categoryFilter").value;

if (search) {
    list = list.filter(product =>
        (
            product.name + " " +
            (product.description || "") + " " +
            (product.categories?.name || "")
        ).toLowerCase().includes(search)
    );
}

if (category) {
    list = list.filter(product =>
        product.category_id === category
    );
}

const sorting = $("sortFilter").value;

if (sorting === "low") {
    list.sort((a, b) => a.price - b.price);
}

if (sorting === "high") {
    list.sort((a, b) => b.price - a.price);
}

const grid = $("productGrid");

if (!list.length) {
    grid.innerHTML = "<p>কোনো পণ্য পাওয়া যায়নি।</p>";
    return;
}

grid.innerHTML = list.map(product => {

    const price = product.sale_price ?? product.price;

    return `
        <div class="product">

            <div class="product-img">

                ${
                    product.image_url
                    ? `<img src="${escapeHTML(product.image_url)}"
                        alt="${escapeHTML(product.name)}">`
                    : "🛍️"
                }

            </div>

            <div class="product-info">

                <h3>${escapeHTML(product.name)}</h3>

                <p class="price">${money(price)}</p>

                <div class="product-actions">

                    <button class="add"
                        data-add="${escapeHTML(product.id)}">
                        Add to Cart
                    </button>

                    <button class="buy"
                        data-buy="${escapeHTML(product.id)}">
                        Buy Now
                    </button>

                </div>

            </div>

        </div>
    `;

}).join("");

document.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => addToCart(button.dataset.add);
});

document.querySelectorAll("[data-buy]").forEach(button => {
    button.onclick = () => {
        addToCart(button.dataset.buy);
        openCheckout();
    };
});

}

// =====================================
// CART
// =====================================

function saveCart() {

localStorage.setItem(
    "shopnexa_cart",
    JSON.stringify(cart)
);

renderCart();

}

function addToCart(productId) {

const product = products.find(p => p.id === productId);

if (!product) return;

const existing = cart.find(item => item.id === productId);

if (existing) {
    existing.qty = Math.min(existing.qty + 1, product.stock);
} else {
    cart.push({
        id: productId,
        qty: 1
    });
}

saveCart();

notify("পণ্য কার্টে যোগ হয়েছে!");

}

function changeQuantity(productId, change) {

const item = cart.find(x => x.id === productId);

const product = products.find(x => x.id === productId);

if (!item || !product) return;

item.qty += change;

if (item.qty <= 0) {
    cart = cart.filter(x => x.id !== productId);
} else {
    item.qty = Math.min(item.qty, product.stock);
}

saveCart();

}

function removeFromCart(productId) {

cart = cart.filter(x => x.id !== productId);

saveCart();

}

function getSubtotal() {

return cart.reduce((total, item) => {

    const product = products.find(p => p.id === item.id);

    if (!product) return total;

    return total +
        Number(product.sale_price ?? product.price) * item.qty;

}, 0);

}

function renderCart() {

$("cartCount").textContent =
    cart.reduce((total, item) => total + item.qty, 0);

$("cartTotal").textContent = money(getSubtotal());

$("cartItems").innerHTML = cart.map(item => {

    const product = products.find(p => p.id === item.id);

    if (!product) return "";

    const price = product.sale_price ?? product.price;

    return `
        <div class="cart-line">

            <h4>${escapeHTML(product.name)}</h4>

            <p>${money(price)} × ${item.qty}</p>

            <button data-minus="${product.id}">−</button>

            <button data-plus="${product.id}">+</button>

            <button data-remove="${product.id}">Remove</button>

        </div>
    `;

}).join("") || "<p>আপনার কার্ট খালি।</p>";

document.querySelectorAll("[data-minus]").forEach(button => {
    button.onclick = () =>
        changeQuantity(button.dataset.minus, -1);
});

document.querySelectorAll("[data-plus]").forEach(button => {
    button.onclick = () =>
        changeQuantity(button.dataset.plus, 1);
});

document.querySelectorAll("[data-remove]").forEach(button => {
    button.onclick = () =>
        removeFromCart(button.dataset.remove);
});

}

// =====================================
// CART DRAWER
// =====================================

function openCart() {

$("cartDrawer").classList.add("open");

$("overlay").classList.add("show");

}

function closeCart() {

$("cartDrawer").classList.remove("open");

$("overlay").classList.remove("show");

}

// =====================================
// LOGIN / REGISTRATION
// =====================================

function updateLoginButton() {

$("loginOpen").textContent =
    currentUser ? "Account" : "Login";

}

function openLogin() {

if (!db) {
    notify("আগে Supabase সেটআপ করুন।");
    return;
}

authMode = "login";

$("authTitle").textContent = "Login";

$("authName").style.display = "none";

$("authSubmit").textContent = "Login";

$("authDialog").showModal();

}

$("switchAuth").onclick = () => {

authMode =
    authMode === "login" ? "signup" : "login";

$("authTitle").textContent =
    authMode === "login" ? "Login" : "Create Account";

$("authName").style.display =
    authMode === "login" ? "none" : "block";

$("authSubmit").textContent =
    authMode === "login" ? "Login" : "Register";

};

$("authSubmit").onclick = async () => {

const email = $("authEmail").value.trim();

const password = $("authPassword").value;

let result;

if (authMode === "signup") {

    result = await db.auth.signUp({

        email,
        password,

        options: {
            data: {
                full_name: $("authName").value.trim()
            }
        }

    });

} else {

    result = await db.auth.signInWithPassword({
        email,
        password
    });

}

if (result.error) {

    $("authMessage").textContent =
        result.error.message;

    return;

}

$("authMessage").textContent =
    authMode === "signup"
    ? "Registration হয়েছে। Email confirmation লাগতে পারে।"
    : "Login সফল হয়েছে।";

if (authMode === "login") {
    $("authDialog").close();
}

};

// =====================================
// CHECKOUT
// =====================================

function openCheckout() {

if (!cart.length) {
    notify("কার্টে কোনো পণ্য নেই।");
    return;
}

closeCart();

$("checkoutTotal").textContent =
    money(getSubtotal() + DELIVERY_CHARGE);

$("checkoutDialog").showModal();

}

$("placeOrder").onclick = async () => {

if (!db) {
    $("checkoutMessage").textContent =
        "Supabase সেটআপ প্রয়োজন।";
    return;
}

const name = $("customerName").value.trim();

const phone = $("customerPhone").value.trim();

const address = $("customerAddress").value.trim();

const area = $("customerArea").value.trim();

const method = $("paymentMethod").value;

const transactionId = $("transactionId").value.trim();

if (!name || !/^01[3-9]\d{8}$/.test(phone) || !address || !area) {

    $("checkoutMessage").textContent =
        "সঠিক নাম, মোবাইল নম্বর ও ঠিকানা লিখুন।";

    return;

}

if (method !== "cod" && !transactionId) {

    $("checkoutMessage").textContent =
        "Transaction ID লিখুন।";

    return;

}

$("placeOrder").disabled = true;

$("checkoutMessage").textContent =
    "অর্ডার পাঠানো হচ্ছে...";

const payload = {

    customer_name: name,

    phone,

    address,

    area,

    payment_method: method,

    transaction_id: transactionId,

    items: cart.map(item => ({
        product_id: item.id,
        quantity: item.qty
    }))

};

const { data, error } = await db.functions.invoke(
    "create-order",
    { body: payload }
);

$("placeOrder").disabled = false;

if (error || !data?.order_id) {

    $("checkoutMessage").textContent =
        error?.message || data?.error || "অর্ডার সম্পন্ন হয়নি।";

    return;

}

cart = [];

saveCart();

$("checkoutMessage").textContent =
    "অর্ডার সফল! Order ID: " + data.order_id;

await loadStore();

};

// =====================================
// EVENTS
// =====================================

$("cartOpen").onclick = openCart;

$("closeCart").onclick = closeCart;

$("overlay").onclick = closeCart;

$("checkoutOpen").onclick = openCheckout;

$("loginOpen").onclick = () => {

if (currentUser) {

    if (confirm("Logout করতে চান?")) {
        db.auth.signOut();
    }

} else {

    openLogin();

}

};

$("searchForm").onsubmit = event => {

event.preventDefault();

renderProducts();

};

$("searchInput").oninput = renderProducts;

$("categoryFilter").onchange = renderProducts;

$("sortFilter").onchange = renderProducts;

// Start website
initializeShop();
