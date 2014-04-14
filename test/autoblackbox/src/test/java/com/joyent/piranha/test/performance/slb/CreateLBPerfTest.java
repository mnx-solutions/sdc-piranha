package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.page;

public class CreateLBPerfTest extends TestWrapper {
    private static LoadBalancers loadBalancers;
    private static EditLoadBalancer editLoadBalancer;

    @BeforeClass
    public static void openSLBPage() {
        timeout = BASE_TIMEOUT;
        loadBalancers = page(SideBarMenu.class).clickLoadBalancers(LoadBalancers.class);
        loadBalancers.waitForLargeSpinnerDisappear();
        editLoadBalancer = loadBalancers.clickCreateButton();
        String lbName = "testLB" + System.currentTimeMillis();
        editLoadBalancer.setName(lbName);
        editLoadBalancer.setProtocol("TCP");
        editLoadBalancer.selectInstance(Common.getSLBTestInstance());
    }

    @Test
    public void createLoadBalancer() {
        loadBalancers = editLoadBalancer.clickCreateButton();
        loadBalancers.waitForMediumSpinnerDisappear();
        loadBalancers.getCreateButton().waitUntil(visible, timeout);
    }
}
