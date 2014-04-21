package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.page;

public class OpenLBEditPerfTest extends TestWrapper {
    private static LoadBalancerDetails loadBalancerDetails;

    @BeforeClass
    public static void openSLBPage() {
        timeout = BASE_TIMEOUT;
        LoadBalancers loadBalancers = page(SideBarMenu.class).clickLoadBalancers(LoadBalancers.class);
        loadBalancers.waitForLargeSpinnerDisappear();
        loadBalancerDetails = loadBalancers.openFirstLBDetails();
    }

    @Test
    public void openLoadBalancerEditForm() {
        EditLoadBalancer editLoadBalancer = loadBalancerDetails.clickEditButton();
        loadBalancerDetails.waitForMediumSpinnerDisappear();
        editLoadBalancer.getPageTitle().waitUntil(visible, timeout);
    }
}
