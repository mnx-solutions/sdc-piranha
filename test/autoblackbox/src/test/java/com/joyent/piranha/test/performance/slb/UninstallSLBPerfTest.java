package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.pageobject.Dashboard;
import com.joyent.piranha.pageobject.LoadBalancers;
import com.joyent.piranha.pageobject.SideBarMenu;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.page;

public class UninstallSLBPerfTest extends TestWrapper {
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openSLBPage() {
        baseUrl = BASE_URL;
        timeout = CHANGE_STATUS_TIMEOUT;
        sideBarMenu = page(SideBarMenu.class);
        sideBarMenu.clickLoadBalancers(LoadBalancers.class);
        sideBarMenu.waitForLargeSpinnerDisappear();
    }

    @Test
    public void uninstallSLB() {
        LoadBalancers loadBalancers = page(LoadBalancers.class);
        Dashboard dashboard = loadBalancers.clickUninstallButton();
        loadBalancers.clickButtonInModal("Yes");
        sideBarMenu.waitForLargeSpinnerDisappear();
        dashboard.getCountInstancesRunning().waitUntil(visible, timeout);
    }
}
