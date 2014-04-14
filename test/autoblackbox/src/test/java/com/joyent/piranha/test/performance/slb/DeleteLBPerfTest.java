package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.page;

public class DeleteLBPerfTest extends TestWrapper {

    @BeforeClass
    public static void openSLBPage() {
        baseUrl = BASE_URL;
        timeout = BASE_TIMEOUT;
        page(LoadBalancers.class).openFirstLBDetails().clickEditButton();
    }

    @Test
    public void deleteLoadBalancer() {
        LoadBalancers loadBalancers = page(EditLoadBalancer.class).clickDeleteButton();
        loadBalancers.clickButtonInModal("Yes");
        loadBalancers.waitForMediumSpinnerDisappear();
        loadBalancers.getCreateButton().waitUntil(visible, timeout);
    }
}
