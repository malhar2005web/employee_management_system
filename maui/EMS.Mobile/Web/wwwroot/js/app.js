document.addEventListener("DOMContentLoaded", () => {
    window.EMS = window.EMS || {};
    
    if (window.EMS.Theme && window.EMS.Theme.Initialize) {
        window.EMS.Theme.Initialize();
    }
    
    // Check Employee access block on Mobile
    const userJson = localStorage.getItem("ems_user") || localStorage.getItem("user");
    if (userJson) {
        try {
            const user = JSON.parse(userJson);
            if (user.role === 'Employee') {
                localStorage.removeItem("ems_user");
                localStorage.removeItem("user");
                localStorage.removeItem("token");
                RenderBlockedScreen();
                return;
            }
        } catch (e) {}
    }
    
    if (window.EMS.Navigation && window.EMS.Navigation.Initialize) {
        window.EMS.Navigation.Initialize();
    }
    
    const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname === "/" || window.location.pathname === "";
    if (!isLoginPage && window.EMS.Layout && window.EMS.Layout.Initialize) {
        window.EMS.Layout.Initialize();
    }
});

function RenderBlockedScreen() {
    document.body.innerHTML = `
        <div style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            padding: 30px; 
            text-align: center; 
            background: linear-gradient(135deg, #1abc9c, #16a085);
            color: white; 
            font-family: 'Inter', sans-serif;
            box-sizing: border-box;
        ">
            <div style="font-size: 64px; margin-bottom: 20px; color: #f1c40f;"><i class="fa-solid fa-laptop-code"></i></div>
            <h1 style="font-size: 26px; font-weight: 800; margin-bottom: 12px;">Desktop Required</h1>
            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px; opacity: 0.9;">
                Employee accounts are restricted to desktop access for secure attendance monitoring and work tracking.<br><br>
                Please login using your office laptop.
            </p>
            <button onclick="if(window.EMS.Native && window.EMS.Native.exit) window.EMS.Native.exit();" style="
                background: white; 
                color: #16a085; 
                border: none; 
                border-radius: 8px; 
                padding: 12px 24px; 
                font-weight: 700; 
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            ">Close App</button>
        </div>
    `;
}
