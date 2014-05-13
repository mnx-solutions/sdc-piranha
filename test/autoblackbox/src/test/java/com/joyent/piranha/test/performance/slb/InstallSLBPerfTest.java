package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.LoadBalancers;
import com.joyent.piranha.pageobject.Login;
import com.joyent.piranha.pageobject.SLBLicense;
import com.joyent.piranha.pageobject.SideBarMenu;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;

public class InstallSLBPerfTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();

    @BeforeClass
    public static void openSLBPage() {
        baseUrl = BASE_URL;
        timeout = BASE_TIMEOUT;
        Login login = open("/", Login.class);
        login.login(USER_NAME, PASSWORD);
        SideBarMenu sideBarMenu = page(SideBarMenu.class);
        sideBarMenu.clickLoadBalancers(SLBLicense.class);
        sideBarMenu.waitForLargeSpinnerDisappear();
    }

    @Test
    public void installSLB() {
        SLBLicense slbLicense = page(SLBLicense.class);
        slbLicense.ckeckAcceptLicense();
        LoadBalancers loadBalancers = slbLicense.clickInstallButton();
        loadBalancers.getCreateButton().waitUntil(visible, timeout);
    }
}
