package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.page;

public class ListLoadBalancersPerfTest extends TestWrapper {

    @BeforeClass
    public static void openSLBPage() {
        timeout = BASE_TIMEOUT;
        page(SideBarMenu.class).clickDashboard();
    }

    @Test
    public void viewLoadBalancersList() {
        LoadBalancers loadBalancers = page(Dashboard.class).clickViewMoreLBDetails();
        loadBalancers.waitForMediumSpinnerDisappear();
        loadBalancers.getCreateButton().waitUntil(visible, timeout);
    }
}
